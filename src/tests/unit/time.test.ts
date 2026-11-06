import { describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import {
  clockMode,
  demoStartInstant,
  freezeTime,
  now,
  resetClock,
  simulateTime,
  subscribeClock,
} from "@/lib/time/clock";
import { formatForViewer, formatShort, lagosTime } from "@/lib/time/zone";
import {
  nextMeeting,
  nextOccurrences,
  occurrences,
  previousOccurrences,
  SATURDAY_RULE,
  THURSDAY_RULE,
} from "@/lib/time/schedule";
import { TIME_PRESETS } from "@/lib/demo/simulate";

describe("simulated clock", () => {
  it("freezes, simulates and resets, notifying subscribers", () => {
    const listener = vi.fn();
    const off = subscribeClock(listener);
    freezeTime("2026-11-07T08:20:00Z");
    expect(clockMode()).toBe("frozen");
    expect(now().toISO()).toBe("2026-11-07T08:20:00.000Z");
    simulateTime("2026-11-07T08:31:00Z");
    expect(clockMode()).toBe("simulated");
    expect(Math.abs(now().toMillis() - Date.parse("2026-11-07T08:31:00Z"))).toBeLessThan(1000);
    resetClock();
    expect(clockMode()).toBe("real");
    expect(listener).toHaveBeenCalledTimes(3);
    off();
  });

  it("starts the demo on Friday 6 November 2026 at the current Lagos time of day", () => {
    const d = demoStartInstant(DateTime.fromISO("2027-03-15T13:45:10Z")).setZone("Africa/Lagos");
    expect(d.toFormat("yyyy-LL-dd HH:mm:ss")).toBe("2026-11-06 14:45:10");
  });

  it("keeps the demo time presets on Lagos wall-clock times", () => {
    const expected = [
      lagosTime(2026, 11, 6, 10, 0),
      lagosTime(2026, 11, 7, 8, 25),
      lagosTime(2026, 11, 7, 9, 20),
      lagosTime(2026, 11, 7, 9, 31),
      lagosTime(2026, 11, 7, 11, 20),
      lagosTime(2026, 11, 12, 19, 30),
      lagosTime(2026, 11, 12, 20, 31),
    ].map((d) => d.toISO());
    expect(TIME_PRESETS.map((p) => p.at)).toEqual(expected);
  });
});

describe("zone formatting", () => {
  it("formats in Lagos and adds Lagos time in brackets for other zones", () => {
    const t = lagosTime(2026, 11, 7, 9, 30);
    expect(formatShort(t)).toBe("Sat 7 Nov, 9:30 am");
    expect(formatForViewer(t, "Africa/Lagos")).toBe("Sat 7 Nov, 9:30 am");
    expect(formatForViewer(t, "Europe/London")).toBe("Sat 7 Nov, 8:30 am (9:30 am Lagos)");
    expect(formatForViewer(t, "America/New_York")).toBe("Sat 7 Nov, 3:30 am (9:30 am Lagos)");
  });
});

describe("meeting schedule", () => {
  const nov6 = lagosTime(2026, 11, 6);
  it("lists the 26 Saturdays and 26 Thursdays before 6 November 2026", () => {
    const sats = previousOccurrences(SATURDAY_RULE, nov6, 26);
    const thus = previousOccurrences(THURSDAY_RULE, nov6, 26);
    expect(sats).toHaveLength(26);
    expect(sats[0].setZone("Africa/Lagos").toFormat("ccc d LLL HH:mm")).toBe("Sat 9 May 09:30");
    expect(sats.at(-1)!.setZone("Africa/Lagos").toFormat("ccc d LLL HH:mm")).toBe("Sat 31 Oct 09:30");
    expect(thus[0].setZone("Africa/Lagos").toFormat("ccc d LLL HH:mm")).toBe("Thu 14 May 20:30");
    expect(thus.at(-1)!.setZone("Africa/Lagos").toFormat("ccc d LLL HH:mm")).toBe("Thu 5 Nov 20:30");
  });
  it("finds the next occurrences and includes a start exactly at `from`", () => {
    expect(nextOccurrences(SATURDAY_RULE, nov6, 2).map((d) => d.toISO())).toEqual([
      lagosTime(2026, 11, 7, 9, 30).toISO(),
      lagosTime(2026, 11, 14, 9, 30).toISO(),
    ]);
    const exact = lagosTime(2026, 11, 7, 9, 30);
    expect(occurrences(SATURDAY_RULE, exact, exact.plus({ minutes: 1 }))).toHaveLength(1);
  });
  it("treats a meeting as next until its check-in window closes, skipping cancelled ones", () => {
    const ms = [
      { id: "a", startsAt: lagosTime(2026, 11, 7, 9, 30).toISO()!, status: "SCHEDULED", closeAfterMin: 120 },
      { id: "b", startsAt: lagosTime(2026, 11, 12, 20, 30).toISO()!, status: "CANCELLED", closeAfterMin: 0 },
      { id: "c", startsAt: lagosTime(2026, 11, 14, 9, 30).toISO()!, status: "SCHEDULED", closeAfterMin: 120 },
    ];
    expect(nextMeeting(ms, lagosTime(2026, 11, 7, 11, 0))?.id).toBe("a");
    expect(nextMeeting(ms, lagosTime(2026, 11, 7, 11, 31))?.id).toBe("c");
  });
});
