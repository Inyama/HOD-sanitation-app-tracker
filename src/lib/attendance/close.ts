import { DateTime } from "luxon";
import type { AttendanceStatus, Meeting, User } from "@/lib/repo/types";
import { absentOrExcused } from "./excuses";

/**
 * Closing a meeting (docs/DECISIONS.md "Which meetings count"): when a geolocation meeting's
 * check-in window ends, everyone expected who has no record becomes Absent, or Excused with an
 * approved excuse. Sheet meetings are closed by confirming their upload instead.
 */

/** When check-in for a meeting is over. */
export function closesAt(meeting: Pick<Meeting, "startsAt" | "endsAt" | "closeAfterMin" | "method">): DateTime {
  const start = DateTime.fromISO(meeting.startsAt, { zone: "utc" });
  if (meeting.method === "SHEET")
    return meeting.endsAt ? DateTime.fromISO(meeting.endsAt, { zone: "utc" }) : start.plus({ hours: 2 });
  return start.plus({ minutes: meeting.closeAfterMin });
}

/** Geolocation (or Both) meetings that are over, not cancelled, and not closed yet. */
export function needsClosing(
  meeting: Pick<Meeting, "startsAt" | "endsAt" | "closeAfterMin" | "method" | "status">,
  now: DateTime,
): boolean {
  if (meeting.method === "SHEET") return false;
  if (meeting.status === "CANCELLED" || meeting.status === "CLOSED") return false;
  return closesAt(meeting) <= now;
}

export interface AbsenceDraft {
  userId: string;
  status: AttendanceStatus;
}

/**
 * Records to add when a meeting closes: expected people (active, approved by the start,
 * not Remote for Saturdays) without a record.
 */
export function absenceDrafts(
  meeting: Pick<Meeting, "type" | "startsAt">,
  people: Pick<User, "id" | "status" | "approvedAt" | "isRemote">[],
  recordedUserIds: Set<string>,
  approvedExcuseUserIds: Set<string>,
): AbsenceDraft[] {
  const start = DateTime.fromISO(meeting.startsAt, { zone: "utc" });
  return people
    .filter(
      (p) =>
        p.status === "ACTIVE" &&
        !!p.approvedAt &&
        DateTime.fromISO(p.approvedAt, { zone: "utc" }) <= start &&
        !(meeting.type === "SATURDAY" && p.isRemote) &&
        !recordedUserIds.has(p.id),
    )
    .map((p) => ({ userId: p.id, status: absentOrExcused(approvedExcuseUserIds.has(p.id)) }));
}
