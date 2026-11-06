import { describe, expect, it } from "vitest";
import { lagosTime } from "@/lib/time/zone";
import { DEFAULT_WINDOW, evaluateCheckIn, evaluateCheckInTime, windowPhase } from "@/lib/attendance/status";
import { offsetCoordinate } from "@/lib/attendance/geofence";

const start = lagosTime(2026, 11, 7, 9, 30);
const at = (h: number, m: number, s = 0) => lagosTime(2026, 11, 7, h, m, s);

describe("evaluateCheckInTime (spec 6.1 boundaries)", () => {
  it.each([
    [at(8, 29, 59), { ok: false, reason: "WINDOW_NOT_OPEN" }],
    [at(8, 30, 0), { ok: true, status: "ON_TIME" }],
    [at(9, 29, 59), { ok: true, status: "ON_TIME" }],
    [at(9, 30, 0), { ok: true, status: "ON_TIME" }],
    [at(9, 30, 1), { ok: true, status: "LATE" }],
    [at(11, 30, 0), { ok: true, status: "LATE" }],
    [at(11, 30, 1), { ok: false, reason: "WINDOW_CLOSED" }],
  ])("%s", (now, expected) => {
    expect(evaluateCheckInTime(now, start, DEFAULT_WINDOW)).toEqual(expected);
  });

  it("a 10-minute grace makes 09:40:00 On time and 09:40:01 Late", () => {
    const rules = { ...DEFAULT_WINDOW, graceMinutes: 10 };
    expect(evaluateCheckInTime(at(9, 40, 0), start, rules)).toEqual({ ok: true, status: "ON_TIME" });
    expect(evaluateCheckInTime(at(9, 40, 1), start, rules)).toEqual({ ok: true, status: "LATE" });
  });

  it("reports the window phase", () => {
    expect(windowPhase(at(8, 25), start, DEFAULT_WINDOW)).toBe("BEFORE");
    expect(windowPhase(at(9, 20), start, DEFAULT_WINDOW)).toBe("OPEN_ON_TIME");
    expect(windowPhase(at(9, 31), start, DEFAULT_WINDOW)).toBe("OPEN_LATE");
    expect(windowPhase(at(11, 31), start, DEFAULT_WINDOW)).toBe("CLOSED");
  });
});

describe("evaluateCheckIn (full decision)", () => {
  const venue = { lat: 6.6018, lng: 3.3515, radiusM: 100 };
  const near = { ...offsetCoordinate(venue.lat, venue.lng, 25, 0), accuracyM: 12 };
  const far = { ...offsetCoordinate(venue.lat, venue.lng, 1400, 1430), accuracyM: 10 };
  const base = {
    meetingStartUtc: start,
    meetingCancelled: false,
    alreadyCheckedIn: false,
    rules: DEFAULT_WINDOW,
    venue,
    reading: near,
  };

  it("is On time inside the radius at 09:29:59 and Late at 09:30:01", () => {
    const a = evaluateCheckIn({ ...base, nowUtc: at(9, 29, 59) });
    const b = evaluateCheckIn({ ...base, nowUtc: at(9, 30, 1) });
    expect(a).toMatchObject({ ok: true, status: "ON_TIME" });
    expect(b).toMatchObject({ ok: true, status: "LATE" });
    if (a.ok) expect(a.distanceM).toBeCloseTo(25, 0);
  });

  it("refuses 2 km away and reports the distance", () => {
    const r = evaluateCheckIn({ ...base, nowUtc: at(9, 20), reading: far });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("OUT_OF_RANGE");
      expect(r.distanceM!).toBeGreaterThan(1900);
      expect(r.distanceM!).toBeLessThan(2100);
    }
  });

  it("asks for a retry when accuracy is worse than 50 m", () => {
    expect(evaluateCheckIn({ ...base, nowUtc: at(9, 20), reading: { ...near, accuracyM: 120 } })).toEqual({
      ok: false,
      reason: "LOW_ACCURACY",
    });
  });

  it("checks cancelled, then already checked in, then time, then location", () => {
    expect(evaluateCheckIn({ ...base, nowUtc: at(9, 20), meetingCancelled: true, alreadyCheckedIn: true })).toEqual({
      ok: false,
      reason: "MEETING_CANCELLED",
    });
    expect(evaluateCheckIn({ ...base, nowUtc: at(9, 20), alreadyCheckedIn: true })).toEqual({
      ok: false,
      reason: "ALREADY_CHECKED_IN",
    });
    expect(evaluateCheckIn({ ...base, nowUtc: at(8, 0), reading: far })).toEqual({
      ok: false,
      reason: "WINDOW_NOT_OPEN",
    });
    expect(evaluateCheckIn({ ...base, nowUtc: at(11, 31), reading: far })).toEqual({
      ok: false,
      reason: "WINDOW_CLOSED",
    });
  });
});
