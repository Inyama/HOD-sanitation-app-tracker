import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { DutyAssignment, Meeting } from "@/lib/repo/types";
import { arrivalTime, holdsSpot } from "@/lib/volunteer/duties";
import { decideSwap, upcomingSaturdays } from "@/lib/volunteer/service";
import { zoneInfo } from "@/lib/volunteer/zones";
import { appUrl, sendBrandedEmail } from "@/lib/notifications/senders";
import { firstName } from "@/lib/notifications/templates";
import { MEETING_ZONE } from "@/lib/time/zone";
import { canPlace, suggestRoster, type RosterZone } from "./roster";
import { audit, fail, materializeMeeting, notify, type OpsContext } from "./ops-common";

/** Duty roster and zones (spec 7.4 item 14): board per Saturday, auto-suggest, publish, swaps. */

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });
const lagosDay = (iso: string) => utc(iso).setZone(MEETING_ZONE).toFormat("ccc d LLL");
const clock = (d: DateTime) => d.setZone(MEETING_ZONE).toFormat("h:mm a").toLowerCase();

async function zonesWithCapacity(repo: Repository): Promise<RosterZone[]> {
  const zones = await repo.zones.list({ orderBy: { field: "name" } });
  return zones.map((z) => ({ id: z.id, name: z.name, capacity: zoneInfo(z.name).capacity }));
}

export async function loadRoster(repo: Repository, now: DateTime, meetingId?: string) {
  const saturdays = await upcomingSaturdays(repo, now, 4);
  const chosen = saturdays.find((m) => m.id === meetingId) ?? saturdays[0] ?? null;
  const [zones, users, duties, teams, teamMembers, rsvps, excuses] = await Promise.all([
    zonesWithCapacity(repo),
    repo.users.list(),
    repo.duties.list(),
    repo.teams.list(),
    repo.teamMembers.list(),
    repo.rsvps.list(),
    repo.excuses.list({ where: { status: "APPROVED" } }),
  ]);
  const meetings = await repo.meetings.list();
  const startOf = new Map(meetings.map((m) => [m.id, m.startsAt]));
  const teamZone = new Map(teams.map((t) => [t.id, t.zoneId]));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const teamOf = new Map(teamMembers.map((tm) => [tm.userId, tm.teamId]));
  const volunteers = users
    .filter((u) => u.role === "VOLUNTEER" && u.status === "ACTIVE")
    .map((u) => {
      const t = teamOf.get(u.id) ?? null;
      return {
        id: u.id,
        name: u.name,
        teamZoneId: t ? (teamZone.get(t) ?? null) : null,
        team: t ? (teamName.get(t) ?? null) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const volunteerIds = new Set(volunteers.map((v) => v.id));
  const name = new Map(users.map((u) => [u.id, u.name]));

  if (!chosen)
    return {
      saturdays: [],
      meeting: null,
      zones,
      volunteers,
      current: [],
      suggestions: [],
      swaps: [],
      unavailable: [],
      publishedAt: null,
    };

  const current = duties.filter((d) => d.meetingId === chosen.id);
  const past = duties.filter((d) => {
    const s = startOf.get(d.meetingId);
    return s && utc(s) < now;
  });
  const unavailable = new Set([
    ...rsvps.filter((r) => r.meetingId === chosen.id && r.answer === "NO").map((r) => r.userId),
    ...excuses.filter((e) => e.meetingId === chosen.id).map((e) => e.userId),
  ]);
  const suggestions = suggestRoster({ zones, volunteers, past, current, unavailable });
  const swaps = duties
    .filter((d) => d.status === "SWAP_REQUESTED" && saturdays.some((s) => s.id === d.meetingId))
    .map((d) => ({
      id: d.id,
      person: name.get(d.userId) ?? "Unknown",
      zone: zones.find((z) => z.id === d.zoneId)?.name ?? "Zone",
      meeting: lagosDay(startOf.get(d.meetingId) ?? saturdays.find((s) => s.id === d.meetingId)!.startsAt),
    }));
  const servedCount = (userId: string) => past.filter((d) => d.userId === userId && d.status !== "SWAPPED").length;

  return {
    saturdays: saturdays.map((s) => ({ id: s.id, label: lagosDay(s.startsAt), startsAt: s.startsAt })),
    meeting: { id: chosen.id, title: chosen.title, startsAt: chosen.startsAt, label: lagosDay(chosen.startsAt) },
    zones: zones.map((z) => ({
      ...z,
      arrival: clock(arrivalTime(chosen.startsAt, z.name)),
      tasks: zoneInfo(z.name).tasks,
    })),
    volunteers: volunteers.map((v) => ({ ...v, served: servedCount(v.id) })),
    current: current
      .filter((d) => volunteerIds.has(d.userId) || holdsSpot(d.status))
      .map((d) => ({
        id: d.id,
        userId: d.userId,
        zoneId: d.zoneId,
        status: d.status,
        name: name.get(d.userId) ?? "Unknown",
      })),
    suggestions: suggestions.map((s) => ({ ...s, name: name.get(s.userId) ?? "Unknown" })),
    swaps,
    unavailable: [...unavailable],
    publishedAt: chosen.rosterPublishedAt ?? null,
  };
}

export type RosterData = Awaited<ReturnType<typeof loadRoster>>;

async function rosterMeeting(
  repo: Repository,
  ctx: OpsContext,
  meetingId: string,
): Promise<Meeting | ReturnType<typeof fail>> {
  const meeting = await materializeMeeting(repo, meetingId);
  if (!meeting || meeting.type === "THURSDAY_PRAYER") return fail("NOT_FOUND", "Choose a Saturday or event.", 404);
  if (meeting.status === "CANCELLED") return fail("CANCELLED", "This meeting was cancelled.", 409);
  if (utc(meeting.startsAt) <= ctx.now) return fail("MEETING_PAST", "This meeting has already started.", 409);
  return meeting;
}

const isFail = (x: unknown): x is ReturnType<typeof fail> =>
  !!x && typeof x === "object" && (x as { ok?: boolean }).ok === false;

async function tellAssigned(
  repo: Repository,
  ctx: OpsContext,
  meeting: Meeting,
  userId: string,
  zoneName: string | null,
) {
  const when = lagosDay(meeting.startsAt);
  const title = zoneName ? `Your duty on ${when}: ${zoneName}` : `Duty change for ${when}`;
  const body = zoneName
    ? `You are serving in ${zoneName} on ${when}. Please arrive by ${clock(arrivalTime(meeting.startsAt, zoneName))} (Lagos time).`
    : `You are no longer on the duty roster for ${when}. Thank you for being available.`;
  await notify(repo, ctx, userId, "DUTY_ROSTER", title, body);
}

export async function assignDuty(repo: Repository, ctx: OpsContext, meetingId: string, userId: string, zoneId: string) {
  const meeting = await rosterMeeting(repo, ctx, meetingId);
  if (isFail(meeting)) return meeting;
  const [zones, person, duties] = await Promise.all([
    zonesWithCapacity(repo),
    repo.users.get(userId),
    repo.duties.list({ where: { meetingId: meeting.id } }),
  ]);
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return fail("NOT_FOUND", "Zone not found.", 404);
  if (!person || person.role !== "VOLUNTEER" || person.status !== "ACTIVE")
    return fail("NOT_VOLUNTEER", "Only active volunteers can be put on the roster.", 422);
  const place = canPlace(zone, duties, userId);
  if (place === "SAME_ZONE") return fail("SAME_ZONE", `${person.name} is already in ${zone.name}.`, 409);
  if (place === "FULL") return fail("FULL", `${zone.name} is full (${zone.capacity} people).`, 409);
  const mine = duties.find((d) => d.userId === userId && holdsSpot(d.status));
  let duty: DutyAssignment;
  if (mine) {
    duty = await repo.duties.update(mine.id, { zoneId, status: "ASSIGNED" });
    await audit(repo, ctx, "DUTY_MOVED", "DutyAssignment", duty.id, { zoneId: mine.zoneId }, { zoneId });
  } else {
    duty = await repo.duties.create({ meetingId: meeting.id, zoneId, userId, status: "ASSIGNED" });
    await audit(repo, ctx, "DUTY_ASSIGNED", "DutyAssignment", duty.id, null, { userId, zoneId, meetingId: meeting.id });
  }
  if (meeting.rosterPublishedAt) await tellAssigned(repo, ctx, meeting, userId, zone.name);
  return { ok: true as const, dutyId: duty.id };
}

export async function removeDuty(repo: Repository, ctx: OpsContext, dutyId: string) {
  const duty = await repo.duties.get(dutyId);
  if (!duty) return fail("NOT_FOUND", "Duty not found.", 404);
  const meeting = await rosterMeeting(repo, ctx, duty.meetingId);
  if (isFail(meeting)) return meeting;
  await repo.duties.delete(duty.id);
  await audit(
    repo,
    ctx,
    "DUTY_REMOVED",
    "DutyAssignment",
    duty.id,
    { userId: duty.userId, zoneId: duty.zoneId, status: duty.status },
    null,
  );
  if (meeting.rosterPublishedAt) await tellAssigned(repo, ctx, meeting, duty.userId, null);
  return { ok: true as const };
}

export async function applySuggestions(
  repo: Repository,
  ctx: OpsContext,
  meetingId: string,
  picks: { userId: string; zoneId: string }[],
) {
  let added = 0;
  const skipped: string[] = [];
  for (const p of picks) {
    const r = await assignDuty(repo, ctx, meetingId, p.userId, p.zoneId);
    if (r.ok) added++;
    else skipped.push(r.message);
  }
  if (!added && skipped.length) return fail("NONE_ADDED", skipped[0], 409);
  return { ok: true as const, added, skipped };
}

export async function publishRoster(repo: Repository, ctx: OpsContext, meetingId: string) {
  const meeting = await rosterMeeting(repo, ctx, meetingId);
  if (isFail(meeting)) return meeting;
  const [duties, zones, users] = await Promise.all([
    repo.duties.list({ where: { meetingId: meeting.id } }),
    zonesWithCapacity(repo),
    repo.users.list(),
  ]);
  const held = duties.filter((d) => holdsSpot(d.status));
  if (!held.length) return fail("EMPTY", "Put at least one volunteer on the roster first.", 422);
  await repo.meetings.update(meeting.id, { rosterPublishedAt: ctx.now.toISO()! });
  const zoneName = new Map(zones.map((z) => [z.id, z.name]));
  const user = new Map(users.map((u) => [u.id, u]));
  for (const d of held) {
    const zn = zoneName.get(d.zoneId) ?? "your zone";
    await tellAssigned(repo, ctx, meeting, d.userId, zn);
    const u = user.get(d.userId);
    if (u?.status === "ACTIVE")
      await sendBrandedEmail(u.email, "DUTY_ROSTER", {
        subject: `Your duty on ${lagosDay(meeting.startsAt)}: ${zn}`,
        preheader: `Arrive by ${clock(arrivalTime(meeting.startsAt, zn))}.`,
        heading: "Your Saturday duty",
        paragraphs: [
          `Hello ${firstName(u.name)},`,
          `You are serving in ${zn} on ${lagosDay(meeting.startsAt)}. Please arrive by ${clock(arrivalTime(meeting.startsAt, zn))} (Lagos time).`,
          `Tasks: ${zoneInfo(zn).tasks}.`,
        ],
        button: { label: "Open the duty board", url: `${appUrl()}/volunteer/duties` },
      });
  }
  await audit(repo, ctx, "DUTIES_PUBLISHED", "Meeting", meeting.id, null, { volunteers: held.length });
  return { ok: true as const, told: held.length };
}

export async function decideRosterSwap(repo: Repository, ctx: OpsContext, dutyId: string, approve: boolean) {
  const res = await decideSwap(repo, ctx.admin, dutyId, approve);
  if (!res.ok) return res;
  const meeting = await repo.meetings.get(res.duty.meetingId);
  const when = meeting ? lagosDay(meeting.startsAt) : "Saturday";
  await notify(
    repo,
    ctx,
    res.duty.userId,
    "DUTY_SWAP",
    approve ? `Swap approved for ${when}` : `Swap declined for ${when}`,
    approve
      ? "Your swap request was approved. You are no longer on duty for that Saturday."
      : "Your swap request was declined, so your duty stays as planned. Speak to your Team Lead if you cannot make it.",
  );
  return { ok: true as const };
}
