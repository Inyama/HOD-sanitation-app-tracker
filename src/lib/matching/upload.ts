import { DateTime } from "luxon";
import type { AttendanceStatus } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import { absentOrExcused } from "@/lib/attendance/excuses";
import type { RowMatch } from "./matchSheet";

/** What confirming an upload does to attendance (spec 6.4). */

export type Resolution =
  | { kind: "ACCEPT" } // EMAIL matches, or a Suggested match the admin confirmed
  | { kind: "ASSIGN"; userId: string } // admin picked the person by hand
  | { kind: "IGNORE" }; // skip the row

export interface ExpectedPerson {
  id: string;
  approvedAt: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REMOVED";
}

export interface RecordDraft {
  userId: string;
  status: AttendanceStatus;
  checkedInAt: string | null;
  rawTime: string | null;
}

/**
 * Parse a sheet time ("20:41", "8:41 pm", "20:41:10" or a full ISO timestamp)
 * as Lagos wall-clock time on the meeting date. Returns null when unreadable.
 */
export function parseSheetTime(raw: string | null | undefined, meetingStartIso: string): DateTime | null {
  if (!raw) return null;
  const s = raw.trim();
  const iso = DateTime.fromISO(s, { zone: MEETING_ZONE });
  if (iso.isValid && /\d{4}-\d{2}-\d{2}/.test(s)) return iso.toUTC();
  const day = DateTime.fromISO(meetingStartIso, { zone: "utc" }).setZone(MEETING_ZONE);
  for (const fmt of ["H:mm", "HH:mm", "H:mm:ss", "HH:mm:ss", "h:mm a", "h:mma", "h:mm:ss a", "h a", "ha"]) {
    const t = DateTime.fromFormat(s.toUpperCase().replace(/\./g, ""), fmt, { zone: MEETING_ZONE });
    if (t.isValid) return day.set({ hour: t.hour, minute: t.minute, second: t.second }).toUTC();
  }
  return null;
}

/**
 * Build the records for a confirmed upload:
 * - matched and confirmed people are present: On time, or Late if the file has a time after the start (+ grace);
 * - expected active people not in the file are Absent, or Excused with an approved excuse.
 */
export function buildUploadRecords(input: {
  meetingStartIso: string;
  graceMinutes: number;
  matches: RowMatch[];
  resolutions: Map<number, Resolution>;
  expected: ExpectedPerson[];
  approvedExcuseUserIds: Set<string>;
}): RecordDraft[] {
  const start = DateTime.fromISO(input.meetingStartIso, { zone: "utc" });
  const lateAfter = start.plus({ minutes: input.graceMinutes });
  const present = new Map<string, RecordDraft>();

  for (const m of input.matches) {
    if (m.matchType === "DUPLICATE") continue;
    const res =
      input.resolutions.get(m.index) ??
      (m.matchType === "EMAIL" ? { kind: "ACCEPT" as const } : { kind: "IGNORE" as const });
    if (res.kind === "IGNORE") continue;
    const userId = res.kind === "ASSIGN" ? res.userId : m.matchedUserId;
    if (!userId || present.has(userId)) continue;
    const t = parseSheetTime(m.row.time ?? null, input.meetingStartIso);
    present.set(userId, {
      userId,
      status: t && t > lateAfter ? "LATE" : "ON_TIME",
      checkedInAt: t ? t.toISO() : null,
      rawTime: m.row.time ?? null,
    });
  }

  const drafts = [...present.values()];
  for (const p of input.expected) {
    if (p.status !== "ACTIVE" || present.has(p.id)) continue;
    if (!p.approvedAt || DateTime.fromISO(p.approvedAt, { zone: "utc" }) > start) continue;
    drafts.push({
      userId: p.id,
      status: absentOrExcused(input.approvedExcuseUserIds.has(p.id)),
      checkedInAt: null,
      rawTime: null,
    });
  }
  return drafts;
}

/**
 * Re-uploading for the same meeting replaces earlier sheet-based records (no double counting).
 * Geolocation and manual records are kept. Returns ids to delete and the drafts to insert.
 */
export function planReplacement<T extends { id: string; userId: string; method: string }>(
  existing: T[],
  drafts: RecordDraft[],
): { deleteIds: string[]; insert: RecordDraft[] } {
  const keptNonSheet = new Set(existing.filter((r) => r.method !== "SHEET").map((r) => r.userId));
  return {
    deleteIds: existing.filter((r) => r.method === "SHEET").map((r) => r.id),
    insert: drafts.filter((d) => !keptNonSheet.has(d.userId)),
  };
}
