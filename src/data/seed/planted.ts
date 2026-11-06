import type { AttendanceStatus } from "@/lib/repo/types";

/**
 * Planted attendance for demo accounts (spec 10.4). Each pattern maps a person's counted
 * meetings (oldest first, as Lagos dates yyyy-mm-dd) to statuses. Everything not listed is On time.
 * Unit tests assert the resulting percentages with the app's own functions.
 */

export interface PlantedPattern {
  absent?: string[] | number[];
  late?: string[] | number[];
  excused?: string[] | number[];
  /** For relative patterns: how many of the most recent counted meetings the person has. */
  countedMeetings?: number;
}

export const PLANTED: Record<string, PlantedPattern> = {
  // 44 of 50 = 88.0%. Last 6 attended (streak 6), absent on 10 Oct.
  // Badges: Perfect Month (August) and On-time x10 (30 Jul to 3 Sep). No others.
  adebayo: {
    absent: ["2026-05-16", "2026-06-20", "2026-07-11", "2026-07-25", "2026-09-19", "2026-10-10"],
    late: ["2026-05-21", "2026-06-04", "2026-07-02", "2026-09-10", "2026-10-22"],
  },
  // 26 of 50 = 52.0% (amber). Absent at odd positions from the 4th meeting on, including 31 Oct.
  chioma: {
    absent: [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49],
    late: [0, 4, 8, 12, 16, 20],
  },
  // 45 of 50 = 90.0% exactly (gold edge).
  ngozi: {
    absent: ["2026-05-23", "2026-07-09", "2026-08-22", "2026-09-24", "2026-10-08"],
    late: ["2026-06-11", "2026-07-18", "2026-09-05", "2026-10-17"],
  },
  // 35 of 39 = 89.7% (2 excused, 4 absent over 41 counted meetings).
  emeka: {
    countedMeetings: 41,
    absent: [3, 12, 22, 33],
    excused: [7, 27],
    late: [5, 15, 30],
  },
  // Approved 16 Oct: 5 counted meetings, 4 of 5 = 80%.
  tobi: {
    late: [2],
    absent: [4],
  },
  // 47 of 50 = 94.0%. Every Saturday from August attended (26 automatic hours + 5 manual = 31).
  grace: {
    absent: ["2026-05-28", "2026-06-13", "2026-09-17"],
    late: ["2026-07-04", "2026-08-13", "2026-10-01"],
  },
  // 34 of 48 = 70.8% (2 excused).
  michael: {
    absent: [2, 5, 9, 12, 16, 19, 23, 26, 30, 33, 37, 40, 44, 47],
    excused: [7, 28],
    late: [0, 11, 21, 35, 42],
  },
};

/** Apply a pattern to a person's counted meeting dates (Lagos yyyy-mm-dd, oldest first). */
export function plantedStatuses(pattern: PlantedPattern, dates: string[]): AttendanceStatus[] {
  const hit = (list: string[] | number[] | undefined, i: number) =>
    !!list && (typeof list[0] === "number" ? (list as number[]).includes(i) : (list as string[]).includes(dates[i]));
  return dates.map((_, i) => {
    if (hit(pattern.absent, i)) return "ABSENT";
    if (hit(pattern.excused, i)) return "EXCUSED";
    if (hit(pattern.late, i)) return "LATE";
    return "ON_TIME";
  });
}
