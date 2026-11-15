import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Meeting, User } from "@/lib/repo/types";
import { randomToken } from "@/lib/auth/tokens";
import { appUrl, sendBrandedEmail } from "@/lib/notifications/senders";
import { firstName } from "@/lib/notifications/templates";
import { meetingsBetween, recurringBetween } from "@/lib/time/schedule";
import { formatShort, MEETING_ZONE } from "@/lib/time/zone";
import { needsClosing } from "@/lib/attendance/close";
import type { MeetingBody, MeetingEditBody } from "@/lib/validation/ops";
import {
  buildMeetings,
  calendarMonth,
  changeNotice,
  checkChange,
  lagosStart,
  MEETING_CHANGE_MESSAGES,
  meetingDefaults,
} from "./meetings";
import { audit, fail, materializeMeeting, notify, type OpsContext } from "./ops-common";

/** Meetings and events (spec 5, 7.4 item 7): calendar, create, edit, cancel and reschedule. */

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

/** Who hears about a change: active people; Saturday changes skip Remote members. */
function audienceFor(meeting: Pick<Meeting, "type">, users: User[]): User[] {
  return users.filter((u) => u.status === "ACTIVE" && !(meeting.type === "SATURDAY" && u.isRemote));
}

export async function loadMeetingsScreen(repo: Repository, now: DateTime, month?: string) {
  const lagosNow = now.setZone(MEETING_ZONE);
  const shown = month ? DateTime.fromISO(`${month}-01`, { zone: MEETING_ZONE }) : lagosNow.startOf("month");
  const monthKey = (shown.isValid ? shown : lagosNow.startOf("month")).toFormat("yyyy-LL");
  const first = DateTime.fromISO(`${monthKey}-01`, { zone: MEETING_ZONE });
  const [stored, settings, venues, records, rsvps] = await Promise.all([
    repo.meetings.list(),
    repo.settings.get(),
    repo.venues.list(),
    repo.records.list(),
    repo.rsvps.list(),
  ]);
  const from = first.minus({ days: 7 }).toUTC();
  const to = first.endOf("month").plus({ days: 7 }).toUTC();
  const inMonth = meetingsBetween(stored, from, to);
  const listFrom = now.minus({ days: 1 });
  const upcoming = meetingsBetween(stored, listFrom, now.plus({ weeks: 6 }))
    .filter((m) => utc(m.startsAt) >= listFrom)
    .slice(0, 30);
  const recent = meetingsBetween(stored, now.minus({ weeks: 6 }), now)
    .filter((m) => utc(m.startsAt) < now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 12);
  const venue = venues.find((v) => v.id === settings.venueId) ?? venues[0];
  const counts = (id: string) => {
    const r = records.filter((x) => x.meetingId === id);
    return {
      present: r.filter((x) => x.status === "ON_TIME" || x.status === "LATE").length,
      going: rsvps.filter((x) => x.meetingId === id && x.answer === "GOING").length,
    };
  };
  const row = (m: Meeting) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    label: formatShort(m.startsAt),
    date: utc(m.startsAt).setZone(MEETING_ZONE).toISODate()!,
    time: utc(m.startsAt).setZone(MEETING_ZONE).toFormat("HH:mm"),
    durationMin: m.endsAt ? Math.round(utc(m.endsAt).diff(utc(m.startsAt), "minutes").minutes) : 120,
    method: m.method,
    status: m.status,
    statusNote: m.statusNote,
    graceMinutes: m.graceMinutes,
    openBeforeMin: m.openBeforeMin,
    closeAfterMin: m.closeAfterMin,
    radiusM: m.radiusM ?? null,
    requireQr: m.requireQr,
    recurring: !!m.recurrenceRule,
    held: utc(m.startsAt) <= now,
    closable: needsClosing(m, now),
    ...counts(m.id),
  });
  return {
    month: monthKey,
    monthLabel: first.toFormat("LLLL yyyy"),
    prevMonth: first.minus({ months: 1 }).toFormat("yyyy-LL"),
    nextMonth: first.plus({ months: 1 }).toFormat("yyyy-LL"),
    today: lagosNow.toISODate()!,
    weeks: calendarMonth(inMonth, monthKey, now),
    upcoming: upcoming.map(row),
    recent: recent.map(row),
    venue: venue ? { name: venue.name, address: venue.address, radiusM: venue.radiusM } : null,
    defaults: {
      SATURDAY: meetingDefaults("SATURDAY", settings),
      THURSDAY_PRAYER: meetingDefaults("THURSDAY_PRAYER", settings),
      SPECIAL: meetingDefaults("SPECIAL", settings),
    },
  };
}

export type MeetingsScreen = Awaited<ReturnType<typeof loadMeetingsScreen>>;
export type MeetingRow = MeetingsScreen["upcoming"][number];

export async function createMeetings(repo: Repository, ctx: OpsContext, body: MeetingBody) {
  const start = lagosStart(body.date, body.time);
  if (!start.isValid) return fail("BAD_DATE", "Choose a valid date and time.", 422);
  if (start.toUTC() <= ctx.now) return fail("IN_PAST", MEETING_CHANGE_MESSAGES.IN_PAST, 422);
  const settings = await repo.settings.get();
  const tags = Array.from({ length: body.repeatWeeks }, () =>
    randomToken(4)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "x"),
  );
  const rows = buildMeetings(body, settings.venueId, tags);
  const stored = await repo.meetings.list();
  const clashes = rows.filter((r) => {
    if (r.type === "SPECIAL") return stored.some((s) => s.id === r.id);
    const existing = stored.find((s) => s.id === r.id);
    // A weekly meeting that is already stored (edited, cancelled or held) is not replaced.
    return !!existing;
  });
  if (clashes.length)
    return fail(
      "CLASH",
      `${clashes.length === 1 ? "That week already has" : `${clashes.length} of those weeks already have`} this meeting. Edit or reschedule it instead.`,
      409,
    );
  const created = await repo.meetings.createMany(rows);
  await audit(repo, ctx, "MEETING_CREATED", "Meeting", created[0].id, null, {
    title: body.title,
    type: body.type,
    startsAt: created[0].startsAt,
    weeks: created.length,
  });
  return { ok: true as const, ids: created.map((m) => m.id) };
}

export async function editMeeting(repo: Repository, ctx: OpsContext, id: string, changes: MeetingEditBody) {
  const meeting = await materializeMeeting(repo, id);
  if (!meeting) return fail("NOT_FOUND", "Meeting not found.", 404);
  const problem = checkChange(meeting, ctx.now);
  if (problem) return fail(problem, MEETING_CHANGE_MESSAGES[problem], 409);
  const sheet = changes.method === "SHEET";
  const patch: Partial<Meeting> = {
    title: changes.title,
    endsAt: utc(meeting.startsAt).plus({ minutes: changes.durationMin }).toISO()!,
    method: changes.method,
    graceMinutes: changes.graceMinutes,
    openBeforeMin: sheet ? 0 : changes.openBeforeMin,
    closeAfterMin: sheet ? 0 : changes.closeAfterMin,
    radiusM: sheet ? null : changes.radiusM,
    requireQr: !sheet && changes.requireQr,
  };
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, meeting[k as keyof Meeting] ?? null]));
  const changed = Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v ?? null)),
  );
  if (!Object.keys(changed).length) return fail("NO_CHANGE", "Nothing changed.", 422);
  await repo.meetings.update(meeting.id, patch);
  await audit(
    repo,
    ctx,
    "MEETING_UPDATED",
    "Meeting",
    meeting.id,
    Object.fromEntries(Object.keys(changed).map((k) => [k, before[k]])),
    changed,
  );
  return { ok: true as const };
}

async function tellPeople(
  repo: Repository,
  ctx: OpsContext,
  meeting: Meeting,
  type: "MEETING_CANCELLED" | "MEETING_RESCHEDULED",
  notice: { title: string; body: string },
) {
  const people = audienceFor(meeting, await repo.users.list());
  for (const p of people) {
    await notify(
      repo,
      ctx,
      p.id,
      type,
      notice.title,
      notice.body,
      `${p.id}:${meeting.id}:${type}:${ctx.now.toMillis()}`,
    );
    await sendBrandedEmail(p.email, type, {
      subject: notice.title,
      preheader: notice.body.slice(0, 90),
      heading: notice.title,
      paragraphs: [`Hello ${firstName(p.name)},`, notice.body],
      button: { label: "See the schedule", url: `${appUrl()}/member/schedule` },
    });
  }
  return people.length;
}

export async function cancelMeeting(repo: Repository, ctx: OpsContext, id: string, reason: string) {
  const meeting = await materializeMeeting(repo, id);
  if (!meeting) return fail("NOT_FOUND", "Meeting not found.", 404);
  const problem = checkChange(meeting, ctx.now);
  if (problem) return fail(problem, MEETING_CHANGE_MESSAGES[problem], 409);
  const notice = changeNotice("CANCELLED", meeting, ensureStop(reason));
  await repo.meetings.update(meeting.id, { status: "CANCELLED", statusNote: notice.statusNote });
  const told = await tellPeople(repo, ctx, meeting, "MEETING_CANCELLED", notice);
  await audit(
    repo,
    ctx,
    "MEETING_CANCELLED",
    "Meeting",
    meeting.id,
    { status: meeting.status },
    { status: "CANCELLED", reason, told },
  );
  return { ok: true as const, told };
}

export async function rescheduleMeeting(
  repo: Repository,
  ctx: OpsContext,
  id: string,
  input: { date: string; time: string; reason: string },
) {
  const meeting = await materializeMeeting(repo, id);
  if (!meeting) return fail("NOT_FOUND", "Meeting not found.", 404);
  const newStart = lagosStart(input.date, input.time);
  if (!newStart.isValid) return fail("BAD_DATE", "Choose a valid date and time.", 422);
  const day = newStart.toISODate();
  const sameDay = recurringBetween(
    await repo.meetings.list(),
    newStart.startOf("day").toUTC(),
    newStart.endOf("day").toUTC(),
  ).filter(
    (m) =>
      m.id !== meeting.id &&
      m.type === meeting.type &&
      m.type !== "SPECIAL" &&
      m.status !== "CANCELLED" &&
      utc(m.startsAt).setZone(MEETING_ZONE).toISODate() === day,
  );
  const problem = checkChange(meeting, ctx.now, newStart.toUTC(), sameDay);
  if (problem) return fail(problem, MEETING_CHANGE_MESSAGES[problem], 409);
  const duration = meeting.endsAt ? utc(meeting.endsAt).diff(utc(meeting.startsAt), "minutes").minutes : 120;
  const notice = changeNotice("RESCHEDULED", meeting, ensureStop(input.reason), newStart);
  await repo.meetings.update(meeting.id, {
    startsAt: newStart.toUTC().toISO()!,
    endsAt: newStart.plus({ minutes: duration }).toUTC().toISO()!,
    statusNote: notice.statusNote,
  });
  const told = await tellPeople(repo, ctx, meeting, "MEETING_RESCHEDULED", notice);
  await audit(
    repo,
    ctx,
    "MEETING_RESCHEDULED",
    "Meeting",
    meeting.id,
    { startsAt: meeting.startsAt },
    { startsAt: newStart.toUTC().toISO(), reason: input.reason, told },
  );
  return { ok: true as const, told };
}

function ensureStop(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
