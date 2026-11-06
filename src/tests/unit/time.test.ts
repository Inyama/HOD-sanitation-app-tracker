import { describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import {
  clockMode,
  decodeClockState,
  encodeClockState,
  freezeTime,
  now,
  nowFromState,
  resetClock,
  simulateTime,
  subscribeClock,
} from "@/lib/time/clock";
import { formatForViewer, formatShort, lagosTime } from "@/lib/time/zone";
import {
  nextMeeting,
  withRecurringMeetings,
  nextOccurrences,
  occurrences,
  previousOccurrences,
  SATURDAY_RULE,
  THURSDAY_RULE,
} from "@/lib/time/schedule";
import { timePresets } from "@/lib/demo/simulate";

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

  it("uses the real time by default (no fixed demo date)", () => {
    expect(clockMode()).toBe("real");
    expect(Math.abs(now().toMillis() - Date.now())).toBeLessThan(1000);
  });

  it("points the time presets at the coming Saturday and Thursday", () => {
    const fmt = (iso: string) => DateTime.fromISO(iso).setZone("Africa/Lagos").toFormat("ccc d LLL HH:mm");
    // Friday 6 November 2026, 10:00 Lagos
    const fri = timePresets(lagosTime(2026, 11, 6, 10, 0)).map((p) => fmt(p.at));
    expect(fri).toEqual([
      "Sat 7 Nov 08:25",
      "Sat 7 Nov 09:20",
      "Sat 7 Nov 09:31",
      "Sat 7 Nov 11:20",
      "Thu 12 Nov 19:30",
      "Thu 12 Nov 20:31",
    ]);
    // Saturday 7 November at 11:00 is still "this Saturday"; at 11:31 it moves to the next one.
    expect(fmt(timePresets(lagosTime(2026, 11, 7, 11, 0))[0].at)).toBe("Sat 7 Nov 08:25");
    expect(fmt(timePresets(lagosTime(2026, 11, 7, 11, 31))[0].at)).toBe("Sat 14 Nov 08:25");
  });

  it("encodes and decodes the demo clock cookie, rejecting junk", () => {
    const st = { kind: "simulated" as const, anchorMs: 1_000, realAnchorMs: 500 };
    expect(decodeClockState(encodeClockState(st))).toEqual(st);
    expect(nowFromState(st, 800)).toBe(1_300);
    expect(decodeClockState("%7B%22kind%22%3A%22simulated%22%7D")).toBeNull();
    expect(decodeClockState("not-json")).toBeNull();
    expect(decodeClockState(undefined)).toBeNull();
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

describe("recurring meetings", () => {
  const stored = [
    {
      id: "mtg-2026-11-07-sat",
      type: "SATURDAY" as const,
      title: "Saturday Sanitation Meeting",
      startsAt: lagosTime(2026, 11, 7, 9, 30).toISO()!,
      endsAt: null,
      venueId: "venue-main",
      method: "GEO" as const,
      graceMinutes: 0,
      openBeforeMin: 60,
      closeAfterMin: 120,
      status: "CANCELLED" as const,
      recurrenceRule: null,
      requireQr: false,
      statusNote: "Cancelled",
    },
  ];

  it("always provides the next Saturday and Thursday, whatever the date", () => {
    const far = lagosTime(2027, 3, 3, 12, 0); // a Wednesday long after the seeded data
    const list = withRecurringMeetings([], far);
    const next = nextMeeting(list, far)!;
    expect(next.title).toBe("Thursday Prayer Meeting");
    expect(DateTime.fromISO(next.startsAt).setZone("Africa/Lagos").toFormat("ccc d LLL HH:mm")).toBe("Thu 4 Mar 20:30");
  });

  it("keeps stored rows (a cancelled Saturday stays cancelled) and adds the rest", () => {
    const at = lagosTime(2026, 11, 7, 8, 0);
    const list = withRecurringMeetings(stored, at);
    expect(list.filter((m) => m.id === "mtg-2026-11-07-sat")).toHaveLength(1);
    expect(list.find((m) => m.id === "mtg-2026-11-07-sat")!.status).toBe("CANCELLED");
    expect(nextMeeting(list, at)!.id).toBe("mtg-2026-11-12-thu");
    expect(list.find((m) => m.id === "mtg-2026-11-14-sat")!.venueId).toBe("venue-main");
  });
});
