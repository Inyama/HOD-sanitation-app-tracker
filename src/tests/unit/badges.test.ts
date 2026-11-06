import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { computeBadges } from "@/lib/attendance/badges";
import type { CountedMeeting } from "@/lib/attendance/aggregate";
import type { AttendanceStatus } from "@/lib/repo/types";
import { lagosTime } from "@/lib/time/zone";

/** Weekly meetings from Saturday 4 July 2026 with the given statuses. */
function weekly(statuses: AttendanceStatus[], from = lagosTime(2026, 7, 4, 9, 30)): CountedMeeting[] {
  return statuses.map((status, i) => ({
    meeting: { id: `m${i}`, type: "SATURDAY", startsAt: from.plus({ weeks: i }).toISO()!, status: "CLOSED" },
    status,
  }));
}
const now = DateTime.fromISO("2026-11-06T09:00:00Z");
const codes = (list: ReturnType<typeof computeBadges>) => list.map((b) => b.code).sort();

describe("badges (spec 6.5)", () => {
  it("Perfect Month needs a completed month with every meeting attended", () => {
    // July 2026 has 4 Saturdays: 4, 11, 18, 25. Late still counts as attended.
    expect(
      codes(computeBadges({ counted: weekly(["ON_TIME", "LATE", "ON_TIME", "ON_TIME", "ABSENT"]), now })),
    ).toContain("PERFECT_MONTH");
    expect(
      codes(computeBadges({ counted: weekly(["ON_TIME", "EXCUSED", "ON_TIME", "ON_TIME", "ABSENT"]), now })),
    ).not.toContain("PERFECT_MONTH");
  });

  it("On-time x10 needs ten consecutive On time (excused skipped, late breaks)", () => {
    const ten = Array<AttendanceStatus>(10).fill("ON_TIME");
    expect(
      codes(computeBadges({ counted: weekly(["LATE", ...ten.slice(0, 5), "EXCUSED", ...ten.slice(5)]), now })),
    ).toContain("ON_TIME_10");
    expect(codes(computeBadges({ counted: weekly([...ten.slice(0, 9), "LATE", "ON_TIME"]), now }))).not.toContain(
      "ON_TIME_10",
    );
  });

  it("Faithful Servant needs 90 percent or more over a completed quarter", () => {
    // Q3 2026: 13 Saturdays from 4 July, 1 absence = 92.3%
    const q3 = weekly(["ON_TIME", "ON_TIME", "ABSENT", ...Array<AttendanceStatus>(10).fill("LATE")]);
    expect(codes(computeBadges({ counted: q3, now }))).toContain("FAITHFUL_SERVANT");
    const weak = weekly(["ABSENT", "ABSENT", ...Array<AttendanceStatus>(11).fill("ON_TIME")]);
    expect(codes(computeBadges({ counted: weak, now }))).not.toContain("FAITHFUL_SERVANT");
  });

  it("Comeback needs the last 3 months 15 points above the 3 before", () => {
    const from = lagosTime(2026, 5, 9, 9, 30);
    const prior = Array<AttendanceStatus>(13)
      .fill("ABSENT")
      .map((s, i) => (i % 2 ? "ON_TIME" : s));
    const recent = Array<AttendanceStatus>(13).fill("ON_TIME");
    expect(codes(computeBadges({ counted: weekly([...prior, ...recent], from), now }))).toContain("COMEBACK");
    expect(codes(computeBadges({ counted: weekly([...recent, ...recent], from), now }))).not.toContain("COMEBACK");
  });

  it("Service Star needs 20 verified hours in one month", () => {
    const h = (hours: number, day: number, verified = true) => ({
      hours,
      createdAt: lagosTime(2026, 10, day, 12).toISO()!,
      verified,
    });
    expect(codes(computeBadges({ counted: [], hours: [h(10, 3), h(10, 17)], now }))).toEqual(["SERVICE_STAR"]);
    expect(codes(computeBadges({ counted: [], hours: [h(10, 3), h(10, 17, false)], now }))).toEqual([]);
  });
});
