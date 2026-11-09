import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AttendanceStatus, Meeting, User } from "@/lib/repo/types";
import { capabilities } from "@/lib/auth/permissions";
import { actorFor } from "@/lib/auth/session";
import { attendanceViews, countedMeetings } from "@/lib/attendance/aggregate";
import { evaluateCheckInTime, REJECTION_MESSAGES } from "@/lib/attendance/status";
import { findMeeting } from "@/lib/attendance/checkin-service";
import { firstName } from "@/lib/notifications/templates";
import { withRecurringMeetings } from "@/lib/time/schedule";
import { MEETING_ZONE } from "@/lib/time/zone";
import { buildDutyBoard, canSignUp, canWithdraw, DUTY_MESSAGES, holdsSpot, type DutyRefusal } from "./duties";
import { MANUAL_MAX, MANUAL_MIN } from "./hours";
import { grantAutoHours } from "./auto-hours";

/** Volunteer actions (spec 7.3, 11). Every write by a leader is written to the audit log. */

export interface Fail {
  ok: false;
  code: string;
  message: string;
  status: number;
}
const fail = (code: string, message: string, status = 422): Fail => ({ ok: false, code, message, status });
const dutyFail = (r: DutyRefusal) => fail(r, DUTY_MESSAGES[r], r === "NOT_YOURS" ? 403 : 422);

async function titlesOf(repo: Repository, userId: string) {
  return (await repo.userTitles.list({ where: { userId } })).map((t) => t.title);
}

/** The next `count` Saturday meetings that have not finished, stored or generated from the weekly rule. */
export async function upcomingSaturdays(repo: Repository, now: DateTime, count = 2): Promise<Meeting[]> {
  const all = withRecurringMeetings(await repo.meetings.list(), now, 6);
  return all
    .filter((m) => m.type === "SATURDAY" && m.status !== "CANCELLED")
    .filter((m) => DateTime.fromISO(m.startsAt).plus({ minutes: m.closeAfterMin }) >= now)
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// Duties
// ---------------------------------------------------------------------------

export async function signUpForDuty(repo: Repository, user: User, meetingId: string, zoneId: string, now: DateTime) {
  const meeting = await findMeeting(repo, meetingId, now);
  if (!meeting || meeting.type === "THURSDAY_PRAYER") return fail("NOT_FOUND", "Meeting not found.", 404);
  const [zones, duties] = await Promise.all([
    repo.zones.list(),
    repo.duties.list({ where: { meetingId: meeting.id } }),
  ]);
  const zone = buildDutyBoard(zones, duties, meeting.id, user.id).find((z) => z.zoneId === zoneId);
  if (!zone) return fail("NOT_FOUND", "Zone not found.", 404);
  const check = canSignUp({
    now,
    meetingStart: meeting.startsAt,
    zone,
    myDutiesForMeeting: duties.filter((d) => d.userId === user.id),
  });
  if (!check.ok) return dutyFail(check.reason);
  // A released (SWAPPED) row for this person and meeting is reused rather than duplicated.
  const old = duties.find((d) => d.userId === user.id && !holdsSpot(d.status));
  const duty = old
    ? await repo.duties.update(old.id, { zoneId, status: "ASSIGNED" })
    : await repo.duties.create({ meetingId: meeting.id, zoneId, userId: user.id, status: "ASSIGNED" });
  return { ok: true as const, duty };
}

export async function withdrawFromDuty(repo: Repository, user: User, dutyId: string, now: DateTime) {
  const duty = await repo.duties.get(dutyId);
  if (!duty || duty.userId !== user.id) return dutyFail("NOT_YOURS");
  const meeting = await repo.meetings.get(duty.meetingId);
  const check = canWithdraw(now, meeting?.startsAt ?? now.toISO()!);
  if (!check.ok) return dutyFail(check.reason);
  await repo.duties.delete(duty.id);
  return { ok: true as const };
}

export async function requestSwap(repo: Repository, user: User, dutyId: string, now: DateTime) {
  const duty = await repo.duties.get(dutyId);
  if (!duty || duty.userId !== user.id) return dutyFail("NOT_YOURS");
  if (duty.status !== "ASSIGNED") return dutyFail("NOT_SWAPPABLE");
  const meeting = await repo.meetings.get(duty.meetingId);
  if (meeting && DateTime.fromISO(meeting.startsAt) <= now) return dutyFail("MEETING_PAST");
  return { ok: true as const, duty: await repo.duties.update(duty.id, { status: "SWAP_REQUESTED" }) };
}

/** Team Leads approve swaps for people in their teams; admins who manage duties approve any. */
export async function decideSwap(repo: Repository, approver: User, dutyId: string, approve: boolean) {
  const duty = await repo.duties.get(dutyId);
  if (!duty || duty.status !== "SWAP_REQUESTED") return fail("NOT_FOUND", "No swap request found.", 404);
  const caps = capabilities(actorFor(approver, await titlesOf(repo, approver.id)));
  let allowed = caps.has("duties.manage");
  if (!allowed && caps.has("team.view")) {
    const led = (await repo.teams.list({ where: { leadUserId: approver.id } })).map((t) => t.id);
    const holderTeams = (await repo.teamMembers.list({ where: { userId: duty.userId } })).map((m) => m.teamId);
    allowed = holderTeams.some((t) => led.includes(t));
  }
  if (!allowed) return fail("FORBIDDEN", "Only the person's Team Lead or an admin can decide this swap.", 403);
  const updated = await repo.duties.update(duty.id, { status: approve ? "SWAPPED" : "ASSIGNED" });
  await repo.audit.append({
    actorId: approver.id,
    action: approve ? "DUTY_SWAP_APPROVED" : "DUTY_SWAP_DECLINED",
    entity: "DutyAssignment",
    entityId: duty.id,
    before: { status: "SWAP_REQUESTED" },
    after: { status: updated.status },
    ip: null,
  });
  return { ok: true as const, duty: updated };
}

// ---------------------------------------------------------------------------
// Hours and issues
// ---------------------------------------------------------------------------

export async function addManualHours(
  repo: Repository,
  user: User,
  input: { date: string; hours: number; note: string },
  now: DateTime,
) {
  const day = DateTime.fromISO(input.date, { zone: MEETING_ZONE });
  if (!day.isValid) return fail("VALIDATION_FAILED", "Choose a valid date.");
  if (day > now.setZone(MEETING_ZONE).endOf("day"))
    return fail("VALIDATION_FAILED", "Hours can only be logged for today or earlier.");
  if (day < now.minus({ days: 60 }))
    return fail("VALIDATION_FAILED", "Hours older than 60 days need an admin to add them.");
  if (input.hours < MANUAL_MIN || input.hours > MANUAL_MAX)
    return fail("VALIDATION_FAILED", `Enter between ${MANUAL_MIN} and ${MANUAL_MAX} hours.`);
  const entry = await repo.serviceHours.create({
    userId: user.id,
    meetingId: null,
    hours: Math.round(input.hours * 2) / 2,
    source: "MANUAL",
    verifiedById: null,
    createdAt: day.set({ hour: 12 }).toUTC().toISO()!,
    note: input.note,
  });
  return { ok: true as const, entry };
}

export async function reportIssue(
  repo: Repository,
  user: User,
  input: { area: string; urgency: "LOW" | "MEDIUM" | "URGENT"; note: string; photoUrl: string | null },
  now: DateTime,
) {
  const issue = await repo.issues.create({
    reporterId: user.id,
    area: input.area,
    urgency: input.urgency,
    photoUrl: input.photoUrl,
    note: input.note,
    status: "OPEN",
    resolvedById: null,
    createdAt: now.toISO()!,
  });
  return { ok: true as const, issue };
}

// ---------------------------------------------------------------------------
// Marshal
// ---------------------------------------------------------------------------

/**
 * Manual check-in by a marshal (spec 7.3): recorded with the marshal's name, shown as Manual,
 * and flagged for admin review. Status still follows the server clock and the window rules.
 */
export async function manualCheckIn(
  repo: Repository,
  marshal: User,
  meetingId: string,
  userId: string,
  note: string,
  now: DateTime,
) {
  const meeting = await findMeeting(repo, meetingId, now);
  if (!meeting) return fail("NOT_FOUND", "Meeting not found.", 404);
  if (meeting.status === "CANCELLED") return fail("MEETING_CANCELLED", REJECTION_MESSAGES.MEETING_CANCELLED);
  if (userId === marshal.id)
    return fail("SELF", "Marshals cannot record themselves. Check in on your own phone, or ask another marshal.", 403);
  const person = await repo.users.get(userId);
  if (!person || person.status !== "ACTIVE") return fail("NOT_FOUND", "That person is not an active member.", 404);
  const time = evaluateCheckInTime(now, DateTime.fromISO(meeting.startsAt, { zone: "utc" }), {
    graceMinutes: meeting.graceMinutes,
    openBeforeMinutes: meeting.openBeforeMin,
    closeAfterMinutes: meeting.closeAfterMin,
  });
  if (!time.ok) return fail(time.reason, REJECTION_MESSAGES[time.reason]);
  const existing = await repo.records.findFirst({ meetingId: meeting.id, userId });
  if (existing && (existing.status === "ON_TIME" || existing.status === "LATE"))
    return fail("ALREADY_CHECKED_IN", `${person.name} is already checked in.`, 409);
  const data = {
    meetingId: meeting.id,
    userId,
    status: time.status as AttendanceStatus,
    checkedInAt: now.toISO()!,
    method: "MANUAL" as const,
    lat: null,
    lng: null,
    accuracyM: null,
    distanceM: null,
    deviceId: null,
    flagged: true,
    flagReason: `Manual check-in by ${marshal.name}: awaiting admin review`,
    sourceUploadId: null,
    recordedById: marshal.id,
    note,
  };
  const record = existing
    ? await repo.records.update(existing.id, data)
    : await repo.records.create({ id: `rec-${meeting.id.slice(4)}-${userId.slice(4)}`, ...data });
  await grantAutoHours(repo, person, meeting, now);
  await repo.audit.append({
    actorId: marshal.id,
    action: "MANUAL_CHECK_IN",
    entity: "AttendanceRecord",
    entityId: record.id,
    before: existing ? { status: existing.status } : null,
    after: { status: record.status, note },
    ip: null,
  });
  return { ok: true as const, record, person: { id: person.id, name: person.name } };
}

// ---------------------------------------------------------------------------
// Team view
// ---------------------------------------------------------------------------

export async function teamStats(repo: Repository, viewer: User, now: DateTime) {
  const caps = capabilities(actorFor(viewer, await titlesOf(repo, viewer.id)));
  const [teams, members, users, meetings, records, duties] = await Promise.all([
    repo.teams.list(),
    repo.teamMembers.list(),
    repo.users.list(),
    repo.meetings.list(),
    repo.records.list(),
    repo.duties.list({ where: { status: "SWAP_REQUESTED" } }),
  ]);
  const mine = caps.has("people.view") ? teams : teams.filter((t) => t.leadUserId === viewer.id);
  return mine.map((t) => {
    const people = members
      .filter((m) => m.teamId === t.id)
      .map((m) => users.find((u) => u.id === m.userId)!)
      .filter((u) => u && u.status === "ACTIVE");
    return {
      id: t.id,
      name: t.name,
      members: people
        .map((u) => {
          const recs = records.filter((r) => r.userId === u.id);
          const v = attendanceViews(recs, meetings, { approvedAt: u.approvedAt, now }).overall;
          const last = countedMeetings(recs, meetings, { approvedAt: u.approvedAt, now })
            .slice(-5)
            .map((c) => ({ date: c.meeting.startsAt, status: c.status }));
          return {
            id: u.id,
            name: u.name,
            role: u.role,
            isLead: u.id === t.leadUserId,
            percent: v.percent,
            band: v.band,
            last,
          };
        })
        .sort((a, b) => Number(b.isLead) - Number(a.isLead) || (a.percent ?? -1) - (b.percent ?? -1)),
      swapRequests: duties
        .filter((d) => people.some((p) => p.id === d.userId))
        .map((d) => ({
          dutyId: d.id,
          userId: d.userId,
          name: users.find((u) => u.id === d.userId)!.name,
          meetingId: d.meetingId,
          zoneId: d.zoneId,
        })),
    };
  });
}

const ENCOURAGE_SUBJECT = "A word of encouragement";

/** One-tap encouragement from a Team Lead (spec 7.3): an in-app message, at most once a day per person. */
export async function sendEncouragement(repo: Repository, lead: User, userId: string, now: DateTime) {
  const stats = await teamStats(repo, lead, now);
  const target = stats.flatMap((t) => t.members).find((m) => m.id === userId);
  if (!target) return fail("FORBIDDEN", "You can only encourage people in your team.", 403);
  if (userId === lead.id) return fail("SELF", "You cannot send encouragement to yourself.");
  const recent = (await repo.messages.list({ where: { senderId: lead.id, subject: ENCOURAGE_SUBJECT } })).filter(
    (m) =>
      m.sentAt &&
      DateTime.fromISO(m.sentAt) > now.minus({ hours: 24 }) &&
      m.audience.kind === "HAND_PICKED" &&
      m.audience.userIds.includes(userId),
  );
  if (recent.length) return fail("ALREADY_SENT", `You already encouraged ${firstName(target.name)} today.`, 429);
  const body =
    target.percent !== null && target.percent >= 90
      ? `Hello ${firstName(target.name)}, thank you for your faithfulness. Your ${target.percent}% attendance is an example to the team. ${firstName(lead.name)}`
      : `Hello ${firstName(target.name)}, we miss serving with you and would love to see you this Saturday. If anything is getting in the way, let me know. ${firstName(lead.name)}`;
  const message = await repo.messages.create({
    senderId: lead.id,
    subject: ENCOURAGE_SUBJECT,
    body,
    audience: { kind: "HAND_PICKED", userIds: [userId] },
    channels: ["IN_APP"],
    scheduledFor: null,
    sentAt: now.toISO()!,
  });
  await repo.messageRecipients.create({
    id: `${message.id}:${userId}`,
    messageId: message.id,
    userId,
    deliveredAt: now.toISO()!,
    readAt: null,
  });
  await repo.notifications.create({
    userId,
    type: "ENCOURAGEMENT",
    channel: "IN_APP",
    title: `A message from ${firstName(lead.name)}`,
    body,
    scheduledFor: now.toISO()!,
    sentAt: now.toISO()!,
    readAt: null,
    status: "SENT",
    dedupeKey: `${userId}:${message.id}:ENCOURAGEMENT:IN_APP`,
  });
  return { ok: true as const, name: target.name };
}
