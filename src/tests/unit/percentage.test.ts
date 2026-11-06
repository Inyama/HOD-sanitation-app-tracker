import { describe, expect, it } from "vitest";
import { attendancePercent, band, onTimeRate } from "@/lib/attendance/percentage";

describe("percentages (spec 6.3)", () => {
  const worked = { onTime: 14, late: 3, absent: 2, excused: 1 };

  it("reproduces the worked example: 89.5 percent and 82.4 percent", () => {
    expect(attendancePercent(worked)).toBe(89.5);
    expect(onTimeRate(worked)).toBe(82.4);
  });

  it("removes excused meetings from the denominator", () => {
    expect(attendancePercent({ onTime: 9, late: 0, absent: 1, excused: 0 })).toBe(90);
    expect(attendancePercent({ onTime: 9, late: 0, absent: 1, excused: 5 })).toBe(90);
  });

  it("counts Late as half with a late weight of 0.5", () => {
    // (14 + 1.5) / 19 = 81.6
    expect(attendancePercent(worked, 0.5)).toBe(81.6);
    expect(attendancePercent({ onTime: 0, late: 4, absent: 0, excused: 0 }, 0.5)).toBe(50);
  });

  it("returns null with nothing to count", () => {
    expect(attendancePercent({ onTime: 0, late: 0, absent: 0, excused: 3 })).toBeNull();
    expect(onTimeRate({ onTime: 0, late: 0, absent: 2, excused: 0 })).toBeNull();
  });

  it("rounds to one decimal", () => {
    expect(attendancePercent({ onTime: 26, late: 0, absent: 3, excused: 0 })).toBe(89.7);
    expect(attendancePercent({ onTime: 2, late: 0, absent: 1, excused: 0 })).toBe(66.7);
  });

  it.each([
    [null, "none", "No meetings yet"],
    [100, "gold", "Gold standard"],
    [90, "gold", "Gold standard"],
    [89.9, "green", "Strong"],
    [75, "green", "Strong"],
    [74.9, "amber", "Needs attention"],
    [50, "amber", "Needs attention"],
    [49.9, "red", "At risk"],
    [0, "red", "At risk"],
  ])("band(%s) is %s", (pct, key, label) => {
    expect(band(pct)).toEqual({ key, label });
  });

  it("accepts custom thresholds", () => {
    expect(band(85, { gold: 85, green: 70, amber: 40 }).key).toBe("gold");
  });
});
