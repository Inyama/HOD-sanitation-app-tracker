import { DateTime } from "luxon";
import type { AttendanceStatus, Meeting } from "@/lib/repo/types";

/** Heatmap cells for the last 12 months (spec 3.5): one per Saturday and Thursday meeting. */

export type HeatCellStatus = AttendanceStatus | "CANCELLED" | "NONE";

export interface HeatCellData {
  date: string;
  meetingName: string;
  row: "Thu" | "Sat";
  status: HeatCellStatus;
}

export function heatCells(
  meetings: Meeting[],
  records: { meetingId: string; status: AttendanceStatus }[],
  now: DateTime,
  months = 12,
): HeatCellData[] {
  const from = now.minus({ months });
  const byMeeting = new Map(records.map((r) => [r.meetingId, r.status]));
  return meetings
    .filter((m) => m.type === "SATURDAY" || m.type === "THURSDAY_PRAYER")
    .filter((m) => {
      const d = DateTime.fromISO(m.startsAt, { zone: "utc" });
      return d >= from && d <= now;
    })
    .map((m) => ({
      date: m.startsAt,
      meetingName: m.title,
      row: m.type === "SATURDAY" ? ("Sat" as const) : ("Thu" as const),
      status: m.status === "CANCELLED" ? ("CANCELLED" as const) : (byMeeting.get(m.id) ?? ("NONE" as const)),
    }));
}
