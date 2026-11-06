/**
 * Attendance percentages (spec section 6.3). Pure functions only.
 * Every screen, export and email must use these; never re-implement the maths.
 */

export interface Counts {
  onTime: number;
  late: number;
  absent: number;
  excused: number;
}

export const EMPTY_COUNTS: Counts = { onTime: 0, late: 0, absent: 0, excused: 0 };

/** Excused meetings are removed from the denominator. Late counts in full unless lateWeight < 1. */
export function attendancePercent(c: Counts, lateWeight = 1): number | null {
  const denominator = c.onTime + c.late + c.absent;
  if (denominator === 0) return null;
  const earned = c.onTime + c.late * lateWeight;
  return Math.round((earned / denominator) * 1000) / 10;
}

/** Share of attended meetings that were On time. */
export function onTimeRate(c: Counts): number | null {
  const attended = c.onTime + c.late;
  if (attended === 0) return null;
  return Math.round((c.onTime / attended) * 1000) / 10;
}

export type BandKey = "none" | "gold" | "green" | "amber" | "red";

export interface Band {
  key: BandKey;
  label: string;
}

export interface BandThresholds {
  gold: number;
  green: number;
  amber: number;
}

export const DEFAULT_BAND_THRESHOLDS: BandThresholds = { gold: 90, green: 75, amber: 50 };

export function band(pct: number | null, t: BandThresholds = DEFAULT_BAND_THRESHOLDS): Band {
  if (pct === null) return { key: "none", label: "No meetings yet" };
  if (pct >= t.gold) return { key: "gold", label: "Gold standard" };
  if (pct >= t.green) return { key: "green", label: "Strong" };
  if (pct >= t.amber) return { key: "amber", label: "Needs attention" };
  return { key: "red", label: "At risk" };
}

export function addCounts(a: Counts, b: Counts): Counts {
  return {
    onTime: a.onTime + b.onTime,
    late: a.late + b.late,
    absent: a.absent + b.absent,
    excused: a.excused + b.excused,
  };
}

export function totalCounted(c: Counts): number {
  return c.onTime + c.late + c.absent + c.excused;
}
