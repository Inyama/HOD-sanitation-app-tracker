import { describe, expect, it } from "vitest";
import {
  clampRadius,
  distanceMetres,
  evaluateLocation,
  isRoundCoordinate,
  offsetCoordinate,
  spoofFlags,
} from "@/lib/attendance/geofence";
import { simulatedReading } from "@/lib/demo/simulate";

const venue = { lat: 6.6018, lng: 3.3515, radiusM: 100 };

describe("haversine distance", () => {
  it("is zero for the same point", () => {
    expect(distanceMetres(6.6018, 3.3515, 6.6018, 3.3515)).toBe(0);
  });
  it("matches known distances", () => {
    // One degree of latitude is about 111.19 km on a 6,371 km sphere.
    expect(distanceMetres(0, 0, 1, 0)).toBeCloseTo(111_195, -1);
    // Lagos (Ikeja) to Abuja is roughly 525 km as the crow flies.
    expect(distanceMetres(6.6018, 3.3515, 9.0765, 7.3986) / 1000).toBeGreaterThan(510);
    expect(distanceMetres(6.6018, 3.3515, 9.0765, 7.3986) / 1000).toBeLessThan(540);
  });
  it("round-trips offsetCoordinate", () => {
    const p = offsetCoordinate(venue.lat, venue.lng, 60, -80);
    expect(distanceMetres(venue.lat, venue.lng, p.lat, p.lng)).toBeCloseTo(100, 0);
  });
});

describe("evaluateLocation", () => {
  it("accepts inside the radius and on the edge", () => {
    const inside = offsetCoordinate(venue.lat, venue.lng, 99.5, 0);
    expect(evaluateLocation({ ...inside, accuracyM: 10 }, venue).ok).toBe(true);
  });
  it("rejects just outside the radius with the distance", () => {
    const out = offsetCoordinate(venue.lat, venue.lng, 101, 0);
    const r = evaluateLocation({ ...out, accuracyM: 10 }, venue);
    expect(r).toMatchObject({ ok: false, reason: "OUT_OF_RANGE" });
  });
  it("uses 50 m as the default accuracy limit", () => {
    expect(evaluateLocation({ lat: venue.lat, lng: venue.lng, accuracyM: 50 }, venue).ok).toBe(true);
    expect(evaluateLocation({ lat: venue.lat, lng: venue.lng, accuracyM: 50.1 }, venue)).toEqual({
      ok: false,
      reason: "LOW_ACCURACY",
    });
  });
  it("clamps the radius to 50 to 300 m", () => {
    expect(clampRadius(20)).toBe(50);
    expect(clampRadius(150)).toBe(150);
    expect(clampRadius(999)).toBe(300);
  });
});

describe("simulated locations (spec 10.5)", () => {
  it("places presets where the spec says", () => {
    const at = simulatedReading("AT_VENUE", venue)!;
    expect(distanceMetres(at.lat, at.lng, venue.lat, venue.lng)).toBeCloseTo(25, 0);
    const far = simulatedReading("FAR_AWAY", venue)!;
    expect(Math.round(distanceMetres(far.lat, far.lng, venue.lat, venue.lng) / 100) / 10).toBe(2);
    expect(simulatedReading("POOR_ACCURACY", venue)!.accuracyM).toBe(120);
    expect(simulatedReading("GPS_UNAVAILABLE", venue)).toBeNull();
  });
});

describe("anti-spoofing flags", () => {
  const p = offsetCoordinate(venue.lat, venue.lng, 12.34, 5.67);
  const attempt = {
    userId: "u1",
    meetingId: "m1",
    deviceId: "dev-a",
    lat: p.lat,
    lng: p.lng,
    accuracyM: 14,
    atMs: 1_000_000_000,
  };
  const clean = { sameMeetingCheckIns: [], previousCheckIn: null, attemptsLast10Min: 0 };

  it("flags nothing for a normal check-in", () => {
    expect(spoofFlags(attempt, clean)).toEqual([]);
  });
  it("flags a device already used by another account for the same meeting", () => {
    expect(spoofFlags(attempt, { ...clean, sameMeetingCheckIns: [{ userId: "u2", deviceId: "dev-a" }] })).toEqual([
      "SHARED_DEVICE",
    ]);
    expect(spoofFlags(attempt, { ...clean, sameMeetingCheckIns: [{ userId: "u1", deviceId: "dev-a" }] })).toEqual([]);
  });
  it("flags a jump of more than 2 km in under 30 minutes", () => {
    const far = offsetCoordinate(venue.lat, venue.lng, 3000, 0);
    expect(spoofFlags(attempt, { ...clean, previousCheckIn: { ...far, atMs: attempt.atMs - 10 * 60_000 } })).toEqual([
      "IMPOSSIBLE_JUMP",
    ]);
    expect(spoofFlags(attempt, { ...clean, previousCheckIn: { ...far, atMs: attempt.atMs - 31 * 60_000 } })).toEqual(
      [],
    );
  });
  it("flags accuracy of exactly 0 or a perfectly round coordinate", () => {
    expect(spoofFlags({ ...attempt, accuracyM: 0 }, clean)).toEqual(["SUSPICIOUS_COORDINATES"]);
    expect(spoofFlags({ ...attempt, lat: 6.6, lng: 3.35 }, clean)).toEqual(["SUSPICIOUS_COORDINATES"]);
    expect(isRoundCoordinate(6.60182, 3.35147)).toBe(false);
  });
  it("flags more than 5 attempts in 10 minutes", () => {
    expect(spoofFlags(attempt, { ...clean, attemptsLast10Min: 4 })).toEqual([]);
    expect(spoofFlags(attempt, { ...clean, attemptsLast10Min: 5 })).toEqual(["TOO_MANY_ATTEMPTS"]);
  });
});
