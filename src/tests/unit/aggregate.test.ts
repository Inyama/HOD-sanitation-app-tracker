import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  attendanceCounts,
  attendanceViews,
  countedMeetings,
  currentStreak,
  isAtRisk,
  longestStreak,
  monthlySeries,
  trailingAbsences,
  type CountableMeeting,
  type CountableRecord,
} from "@/lib/attendance/aggregate";
import { attendancePercent } from "@/lib/attendance/percentage";
import { statusAfterDecision, canSubmitExcuse } from "@/lib/attendance/excuses";
import { lagosTime } from "@/lib/time/zone";
import type { AttendanceStatus } from "@/lib/repo/types";

// Ten Saturdays from 5 Sep 2026, one cancelled, two in the future relative to `now`.
const sats = Array.from({ length: 10 }, (_, i) => lagosTime(2026, 9, 5, 9, 30).plus({ weeks: i }));
const meetings: CountableMeeting[] = sats.map((d, i) => ({
  id: `m${i}`,
  type: i % 2 ? "THURSDAY_PRAYER" : "SATURDAY",
  startsAt: d.toISO()!,
  status: i === 3 ? "CANCELLED" : "CLOSED",
}));
const now = sats[7].plus({ days: 1 }); // after m7, before m8 and m9
const rec = (statuses: (AttendanceStatus | null)[]): CountableRecord[] =>
  statuses.flatMap((s, i) => (s ? [{ meetingId: `m${i}`, status: s }] : []));
const yearAgo = lagosTime(2025, 11, 1).toISO()!;

describe("which meetings count", () => {
  it("skips cancelled and future meetings", () => {
    const r = rec([
      "ON_TIME",
      "ON_TIME",
      "ON_TIME",
      "ABSENT",
      "ON_TIME",
      "ON_TIME",
      "ON_TIME",
      "ON_TIME",
      "ABSENT",
      "ABSENT",
    ]);
    const c = attendanceCounts(r, meetings, { approvedAt: yearAgo, now });
    // m3 cancelled, m8 and m9 in the future
    expect(c).toEqual({ onTime: 7, late: 0, absent: 0, excused: 0 });
  });

  it("a cancelled meeting changes nothing", () => {
    const r = rec(["ON_TIME", "ABSENT", "LATE", null, "ON_TIME", "ON_TIME", "ON_TIME", "ON_TIME"]);
    const with3 = [...r, { meetingId: "m3", status: "ABSENT" as const }];
    expect(attendanceCounts(r, meetings, { approvedAt: yearAgo, now })).toEqual(
      attendanceCounts(with3, meetings, { approvedAt: yearAgo, now }),
    );
  });

  it("starts a mid-year joiner's percentage at their approval date", () => {
    const r = rec(["ABSENT", "ABSENT", "ABSENT", null, "ON_TIME", "ON_TIME", "LATE", "ON_TIME"]);
    const approvedAt = sats[4].minus({ hours: 1 }).toISO()!;
    const c = attendanceCounts(r, meetings, { approvedAt, now });
    expect(c).toEqual({ onTime: 3, late: 1, absent: 0, excused: 0 });
    expect(attendancePercent(c)).toBe(100);
  });

  it("counts an early check-in before the meeting starts, but nothing else in the future", () => {
    const r = [
      ...rec(["ON_TIME"]),
      { meetingId: "m8", status: "ON_TIME" as const },
      { meetingId: "m9", status: "ABSENT" as const },
    ];
    expect(countedMeetings(r, meetings, { approvedAt: yearAgo, now }).map((x) => x.meeting.id)).toEqual(["m0", "m8"]);
  });

  it("does not count a held meeting that has no record yet (pending sheet)", () => {
    const r = rec(["ON_TIME", null, "ON_TIME"]);
    expect(countedMeetings(r, meetings, { approvedAt: yearAgo, now }).map((x) => x.meeting.id)).toEqual(["m0", "m2"]);
  });

  it("returns nothing for a person who is not approved", () => {
    expect(countedMeetings(rec(["ON_TIME"]), meetings, { approvedAt: null, now })).toEqual([]);
  });

  it("filters by meeting type", () => {
    const r = rec(["ON_TIME", "ABSENT", "ON_TIME", null, "ON_TIME", "ABSENT", "ON_TIME", "ABSENT"]);
    expect(attendanceCounts(r, meetings, { approvedAt: yearAgo, now, type: "SATURDAY" }).absent).toBe(0);
    expect(attendanceCounts(r, meetings, { approvedAt: yearAgo, now, type: "THURSDAY_PRAYER" }).absent).toBe(3);
  });
});

describe("excuses", () => {
  it("an approved excuse turns Absent into Excused and raises the percentage", () => {
    const before = rec(["ON_TIME", "ON_TIME", "ABSENT", null, "ON_TIME"]);
    const pctBefore = attendancePercent(attendanceCounts(before, meetings, { approvedAt: yearAgo, now }));
    const after = before.map((r) =>
      r.meetingId === "m2" ? { ...r, status: statusAfterDecision(r.status, "APPROVED")! } : r,
    );
    const pctAfter = attendancePercent(attendanceCounts(after, meetings, { approvedAt: yearAgo, now }));
    expect(after.find((r) => r.meetingId === "m2")!.status).toBe("EXCUSED");
    expect(pctBefore).toBe(75);
    expect(pctAfter).toBe(100);
  });

  it("a declined excuse leaves Absent, and attended records are never downgraded", () => {
    expect(statusAfterDecision("ABSENT", "DECLINED")).toBe("ABSENT");
    expect(statusAfterDecision("LATE", "APPROVED")).toBe("LATE");
    expect(statusAfterDecision(null, "APPROVED")).toBe("EXCUSED");
  });

  it("can be submitted from 7 days before to 7 days after the meeting", () => {
    const m = lagosTime(2026, 11, 7, 9, 30);
    expect(canSubmitExcuse(m.minus({ days: 7 }), m.toISO()!)).toEqual({ ok: true });
    expect(canSubmitExcuse(m.minus({ days: 7, minutes: 1 }), m.toISO()!)).toEqual({ ok: false, reason: "TOO_EARLY" });
    expect(canSubmitExcuse(m.plus({ days: 7 }), m.toISO()!)).toEqual({ ok: true });
    expect(canSubmitExcuse(m.plus({ days: 7, minutes: 1 }), m.toISO()!)).toEqual({ ok: false, reason: "TOO_LATE" });
  });
});

describe("streaks and risk", () => {
  const counted = (statuses: AttendanceStatus[]) =>
    statuses.map((status, i) => ({
      meeting: {
        id: `x${i}`,
        type: "SATURDAY" as const,
        startsAt: `2026-01-${String(i + 1).padStart(2, "0")}T08:30:00.000Z`,
        status: "CLOSED" as const,
      },
      status,
    }));

  it("current streak skips excused and stops at an absence", () => {
    expect(currentStreak(counted(["ON_TIME", "ABSENT", "ON_TIME", "EXCUSED", "LATE", "ON_TIME"]))).toBe(3);
    expect(currentStreak(counted(["ON_TIME", "ABSENT"]))).toBe(0);
  });
  it("longest streak", () => {
    expect(longestStreak(counted(["ON_TIME", "ON_TIME", "ON_TIME", "ABSENT", "LATE", "ON_TIME"]))).toBe(3);
  });
  it("trailing absences and at-risk rule (below 60 percent or three absences in a row)", () => {
    expect(trailingAbsences(counted(["ON_TIME", "ABSENT", "EXCUSED", "ABSENT", "ABSENT"]))).toBe(3);
    expect(isAtRisk(59.9, 0)).toBe(true);
    expect(isAtRisk(60, 0)).toBe(false);
    expect(isAtRisk(85, 3)).toBe(true);
    expect(isAtRisk(null, 0)).toBe(false);
  });
});

describe("views", () => {
  it("returns overall, Saturday, Thursday, last 3 months and year to date from the same function", () => {
    const r = rec(["ON_TIME", "ABSENT", "LATE", null, "ON_TIME", "ON_TIME", "ABSENT", "ON_TIME"]);
    const v = attendanceViews(r, meetings, { approvedAt: yearAgo, now });
    expect(Object.keys(v)).toEqual(["overall", "saturday", "thursday", "last3Months", "yearToDate"]);
    expect(v.overall.counts).toEqual({ onTime: 4, late: 1, absent: 2, excused: 0 });
    expect(v.saturday.percent).toBe(75);
    expect(v.thursday.percent).toBe(66.7);
    expect(v.yearToDate.counts).toEqual(v.overall.counts);
  });

  it("monthly series covers 12 months ending in the current month", () => {
    const r = rec(["ON_TIME", "ABSENT", "LATE", null, "ON_TIME", "ON_TIME", "ABSENT", "ON_TIME"]);
    const series = monthlySeries(r, meetings, { approvedAt: yearAgo, now: DateTime.fromISO("2026-11-06T09:00:00Z") });
    expect(series).toHaveLength(12);
    expect(series.at(-1)!.month).toBe("2026-11");
    expect(series.find((p) => p.month === "2026-09")!.counts).toEqual({ onTime: 1, late: 1, absent: 1, excused: 0 });
  });
});
