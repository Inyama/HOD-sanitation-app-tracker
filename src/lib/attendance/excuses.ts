import { DateTime } from "luxon";
import type { AttendanceStatus, ExcuseStatus } from "@/lib/repo/types";

/** Excuse rules (spec 6.6). */

export const EXCUSE_WINDOW_DAYS = 7;

/** Members can submit an excuse from 7 days before a meeting to 7 days after it. */
export function canSubmitExcuse(
  now: DateTime,
  meetingStartIso: string,
): { ok: true } | { ok: false; reason: "TOO_EARLY" | "TOO_LATE" } {
  const start = DateTime.fromISO(meetingStartIso, { zone: "utc" });
  if (now < start.minus({ days: EXCUSE_WINDOW_DAYS })) return { ok: false, reason: "TOO_EARLY" };
  if (now > start.plus({ days: EXCUSE_WINDOW_DAYS })) return { ok: false, reason: "TOO_LATE" };
  return { ok: true };
}

/**
 * Status of the attendance record after an admin decision.
 * Approved turns Absent (or a not-yet-recorded meeting) into Excused, removing it from the denominator.
 * Declined leaves the record as it was (Absent stays Absent). Attended records are never downgraded.
 */
export function statusAfterDecision(
  current: AttendanceStatus | null,
  decision: Exclude<ExcuseStatus, "PENDING">,
): AttendanceStatus | null {
  if (current === "ON_TIME" || current === "LATE") return current;
  if (decision === "APPROVED") return "EXCUSED";
  return current;
}

/** When a meeting closes or a sheet is confirmed: absent people with an approved excuse become Excused. */
export function absentOrExcused(hasApprovedExcuse: boolean): AttendanceStatus {
  return hasApprovedExcuse ? "EXCUSED" : "ABSENT";
}
