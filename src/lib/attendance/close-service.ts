import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Meeting } from "@/lib/repo/types";
import { recurringBetween } from "@/lib/time/schedule";
import { absenceDrafts, closesAt, needsClosing } from "./close";

/** Write absentees for one meeting whose window has ended and mark it Closed. */
export async function closeMeeting(repo: Repository, meeting: Meeting, now: DateTime, actorId: string | null) {
  if (!needsClosing(meeting, now)) return { closed: false, absent: 0, excused: 0 };
  const [users, records, excuses] = await Promise.all([
    repo.users.list(),
    repo.records.list({ where: { meetingId: meeting.id } }),
    repo.excuses.list({ where: { meetingId: meeting.id, status: "APPROVED" } }),
  ]);
  const drafts = absenceDrafts(
    meeting,
    users,
    new Set(records.map((r) => r.userId)),
    new Set(excuses.map((e) => e.userId)),
  );
  await repo.transaction(async (tx) => {
    await tx.records.createMany(
      drafts.map((d) => ({
        meetingId: meeting.id,
        userId: d.userId,
        status: d.status,
        checkedInAt: null,
        method: "MANUAL" as const,
        lat: null,
        lng: null,
        accuracyM: null,
        distanceM: null,
        deviceId: null,
        flagged: false,
        flagReason: null,
        sourceUploadId: null,
        recordedById: actorId,
        note: d.status === "EXCUSED" ? "Approved excuse" : "No check-in by the time the window closed",
      })),
    );
    await tx.meetings.update(meeting.id, { status: "CLOSED" });
  });
  const absent = drafts.filter((d) => d.status === "ABSENT").length;
  await repo.audit.append({
    actorId,
    action: "MEETING_CLOSED",
    entity: "Meeting",
    entityId: meeting.id,
    before: { status: meeting.status },
    after: { status: "CLOSED", absent, excused: drafts.length - absent },
    ip: null,
    createdAt: now.toISO()!,
  });
  return { closed: true, absent, excused: drafts.length - absent };
}

/**
 * Close the stored meetings whose window ended between `since` and `now` (scheduler).
 * Older unclosed meetings wait for an admin to close them from the Meetings screen, so a
 * server that was off (or a demo opened weeks later) never mass-marks people absent.
 */
export async function closeDueMeetings(repo: Repository, since: DateTime, now: DateTime) {
  const stored = await repo.meetings.list();
  const storedIds = new Set(stored.map((m) => m.id));
  // Weekly meetings nobody checked in to are not stored yet, so include the generated ones.
  const meetings = recurringBetween(stored, since.minus({ days: 1 }), now).filter((m) => {
    if (!needsClosing(m, now)) return false;
    const at = closesAt(m);
    return at > since && at <= now;
  });
  const out = [];
  for (const m of meetings) {
    const meeting = storedIds.has(m.id) ? m : await repo.meetings.create(m);
    out.push({ id: m.id, ...(await closeMeeting(repo, meeting, now, null)) });
  }
  return out;
}
