import { DateTime } from "luxon";
import type { AttendanceRecord, AttendanceStatus, Meeting } from "@/lib/repo/types";

/**
 * Corrections and disputes (spec 7.4 item 15): a record changes only with a reason, and the
 * audit keeps before and after.
 */

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  ON_TIME: "On time",
  LATE: "Late",
  ABSENT: "Absent",
  EXCUSED: "Excused",
};

export interface CorrectionInput {
  status: AttendanceStatus;
  reason: string;
  /** Lagos time (HH:mm) of arrival, for On time or Late; optional. */
  arrivedAt?: string | null;
}

export type CorrectionError = "NO_CHANGE" | "TIME_STATUS_MISMATCH" | "FUTURE_MEETING";

export const CORRECTION_MESSAGES: Record<CorrectionError, string> = {
  NO_CHANGE: "Nothing would change. Use Mark as reviewed to clear the flag instead.",
  TIME_STATUS_MISMATCH:
    "That arrival time does not fit the status: before the start (plus grace) is On time, after it is Late.",
  FUTURE_MEETING: "This meeting has not started yet.",
};

/** The fields to change on the record, or an error. Corrections clear the flag and are marked Manual. */
export function correctionPatch(
  record: Pick<AttendanceRecord, "status" | "checkedInAt" | "flagged">,
  meeting: Pick<Meeting, "startsAt" | "graceMinutes">,
  input: CorrectionInput,
  adminId: string,
  now: DateTime,
): { ok: true; patch: Partial<AttendanceRecord> } | { ok: false; error: CorrectionError } {
  const start = DateTime.fromISO(meeting.startsAt, { zone: "utc" });
  if (start > now) return { ok: false, error: "FUTURE_MEETING" };
  let checkedInAt: string | null = record.checkedInAt;
  if (input.status === "ABSENT" || input.status === "EXCUSED") checkedInAt = null;
  if (input.arrivedAt && (input.status === "ON_TIME" || input.status === "LATE")) {
    const [h, m] = input.arrivedAt.split(":").map(Number);
    const t = start.setZone("Africa/Lagos").set({ hour: h, minute: m, second: 0, millisecond: 0 }).toUTC();
    const late = t > start.plus({ minutes: meeting.graceMinutes });
    if (late !== (input.status === "LATE")) return { ok: false, error: "TIME_STATUS_MISMATCH" };
    checkedInAt = t.toISO();
  }
  if (input.status === record.status && checkedInAt === record.checkedInAt) return { ok: false, error: "NO_CHANGE" };
  return {
    ok: true,
    patch: {
      status: input.status,
      checkedInAt,
      method: "MANUAL",
      flagged: false,
      flagReason: null,
      recordedById: adminId,
      note: input.reason,
    },
  };
}

/** A new record for a held meeting that has none yet (e.g. a dispute about a missing check-in). */
export function newRecordFor(meetingId: string, userId: string): Omit<AttendanceRecord, "id"> {
  return {
    meetingId,
    userId,
    status: "ABSENT",
    checkedInAt: null,
    method: "MANUAL",
    lat: null,
    lng: null,
    accuracyM: null,
    distanceM: null,
    deviceId: null,
    flagged: false,
    flagReason: null,
    sourceUploadId: null,
    recordedById: null,
    note: null,
  };
}

export function recordSnapshot(r: Pick<AttendanceRecord, "status" | "checkedInAt" | "method" | "flagged">) {
  return { status: r.status, checkedInAt: r.checkedInAt, method: r.method, flagged: r.flagged };
}
