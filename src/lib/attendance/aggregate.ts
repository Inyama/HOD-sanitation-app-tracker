import { DateTime } from "luxon";
import type { AttendanceStatus, MeetingStatus, MeetingType } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import {
  attendancePercent,
  band,
  DEFAULT_BAND_THRESHOLDS,
  EMPTY_COUNTS,
  onTimeRate,
  type Band,
  type BandThresholds,
  type Counts,
} from "./percentage";

/**
 * Which meetings count, and how records become Counts (spec 6.3 rules).
 *
 * - Only meetings that have been held (start time not in the future) and are not cancelled.
 *   An early check-in (On time, before the start) counts straight away.
 * - Only meetings on or after the person's approvedAt.
 * - A held meeting with no record yet (e.g. a Thursday sheet not uploaded) is pending and not counted.
 *   Absent records are written when a meeting closes (see docs/DECISIONS.md).
 */

export interface CountableMeeting {
  id: string;
  type: MeetingType;
  startsAt: string;
  status: MeetingStatus;
}

export interface CountableRecord {
  meetingId: string;
  status: AttendanceStatus;
}

export interface CountOptions {
  approvedAt: string | null;
  now: DateTime;
  type?: MeetingType;
  from?: DateTime;
  to?: DateTime;
}

export interface CountedMeeting {
  meeting: CountableMeeting;
  status: AttendanceStatus;
}

/** Meetings that count for a person, oldest first, paired with that person's status. */
export function countedMeetings(
  records: CountableRecord[],
  meetings: CountableMeeting[],
  opts: CountOptions,
): CountedMeeting[] {
  if (!opts.approvedAt) return [];
  const approved = DateTime.fromISO(opts.approvedAt, { zone: "utc" });
  const byMeeting = new Map(records.map((r) => [r.meetingId, r.status]));
  const out: CountedMeeting[] = [];
  for (const m of meetings) {
    if (m.status === "CANCELLED") continue;
    if (opts.type && m.type !== opts.type) continue;
    const start = DateTime.fromISO(m.startsAt, { zone: "utc" });
    const status = byMeeting.get(m.id);
    // A meeting that has not started yet counts only once the person has checked in early.
    if (start > opts.now && status !== "ON_TIME") continue;
    if (start < approved) continue;
    if (opts.from && start < opts.from) continue;
    if (opts.to && start > opts.to) continue;
    if (!status) continue;
    out.push({ meeting: m, status });
  }
  return out.sort((a, b) => a.meeting.startsAt.localeCompare(b.meeting.startsAt));
}

export function tally(statuses: AttendanceStatus[]): Counts {
  const c: Counts = { ...EMPTY_COUNTS };
  for (const s of statuses) {
    if (s === "ON_TIME") c.onTime++;
    else if (s === "LATE") c.late++;
    else if (s === "ABSENT") c.absent++;
    else c.excused++;
  }
  return c;
}

export function attendanceCounts(records: CountableRecord[], meetings: CountableMeeting[], opts: CountOptions): Counts {
  return tally(countedMeetings(records, meetings, opts).map((x) => x.status));
}

export interface AttendanceView {
  counts: Counts;
  percent: number | null;
  onTimeRate: number | null;
  band: Band;
}

export function toView(
  counts: Counts,
  lateWeight = 1,
  thresholds: BandThresholds = DEFAULT_BAND_THRESHOLDS,
): AttendanceView {
  const percent = attendancePercent(counts, lateWeight);
  return { counts, percent, onTimeRate: onTimeRate(counts), band: band(percent, thresholds) };
}

export type ViewKey = "overall" | "saturday" | "thursday" | "last3Months" | "yearToDate";

export const VIEW_LABELS: Record<ViewKey, string> = {
  overall: "Overall",
  saturday: "Saturday only",
  thursday: "Thursday only",
  last3Months: "Last 3 months",
  yearToDate: "Year to date",
};

/** The five standard views shown everywhere (spec 6.3). One function feeds every screen, export and email. */
export function attendanceViews(
  records: CountableRecord[],
  meetings: CountableMeeting[],
  opts: { approvedAt: string | null; now: DateTime; lateWeight?: number; thresholds?: BandThresholds },
): Record<ViewKey, AttendanceView> {
  const base = { approvedAt: opts.approvedAt, now: opts.now };
  const lw = opts.lateWeight ?? 1;
  const nowLagos = opts.now.setZone(MEETING_ZONE);
  const v = (o: Partial<CountOptions>) =>
    toView(attendanceCounts(records, meetings, { ...base, ...o }), lw, opts.thresholds);
  return {
    overall: v({}),
    saturday: v({ type: "SATURDAY" }),
    thursday: v({ type: "THURSDAY_PRAYER" }),
    last3Months: v({ from: opts.now.minus({ months: 3 }) }),
    yearToDate: v({ from: nowLagos.startOf("year").toUTC() }),
  };
}

const attended = (s: AttendanceStatus) => s === "ON_TIME" || s === "LATE";

/** Consecutive attended meetings ending at the most recent one. Excused meetings neither add nor break. */
export function currentStreak(counted: CountedMeeting[]): number {
  let n = 0;
  for (let i = counted.length - 1; i >= 0; i--) {
    const s = counted[i].status;
    if (s === "EXCUSED") continue;
    if (!attended(s)) break;
    n++;
  }
  return n;
}

export function longestStreak(counted: CountedMeeting[]): number {
  let best = 0;
  let run = 0;
  for (const { status } of counted) {
    if (status === "EXCUSED") continue;
    run = attended(status) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Consecutive absences ending at the most recent counted meeting (used for at-risk and escalation). */
export function trailingAbsences(counted: CountedMeeting[]): number {
  let n = 0;
  for (let i = counted.length - 1; i >= 0; i--) {
    const s = counted[i].status;
    if (s === "EXCUSED") continue;
    if (s !== "ABSENT") break;
    n++;
  }
  return n;
}

/** At risk: below the threshold percentage, or three absences in a row (spec 7.4). */
export function isAtRisk(
  percent: number | null,
  consecutiveAbsences: number,
  thresholdPercent = 60,
  absencesInARow = 3,
): boolean {
  return (percent !== null && percent < thresholdPercent) || consecutiveAbsences >= absencesInARow;
}

export interface MonthPoint {
  month: string; // yyyy-LL
  label: string; // "Nov"
  counts: Counts;
  percent: number | null;
}

/** Percentage per calendar month (Lagos) for the last `months` months, oldest first. */
export function monthlySeries(
  records: CountableRecord[],
  meetings: CountableMeeting[],
  opts: { approvedAt: string | null; now: DateTime; months?: number; lateWeight?: number },
): MonthPoint[] {
  const months = opts.months ?? 12;
  const counted = countedMeetings(records, meetings, { approvedAt: opts.approvedAt, now: opts.now });
  const start = opts.now
    .setZone(MEETING_ZONE)
    .startOf("month")
    .minus({ months: months - 1 });
  const points: MonthPoint[] = [];
  for (let i = 0; i < months; i++) {
    const m = start.plus({ months: i });
    const key = m.toFormat("yyyy-LL");
    const statuses = counted
      .filter(
        (c) => DateTime.fromISO(c.meeting.startsAt, { zone: "utc" }).setZone(MEETING_ZONE).toFormat("yyyy-LL") === key,
      )
      .map((c) => c.status);
    const counts = tally(statuses);
    points.push({
      month: key,
      label: m.toFormat("LLL"),
      counts,
      percent: attendancePercent(counts, opts.lateWeight ?? 1),
    });
  }
  return points;
}
