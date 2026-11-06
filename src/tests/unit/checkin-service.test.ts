// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createJsonMockRepository } from "@/lib/repo/json-mock";
import { buildSeed } from "@/data/seed";
import { resetAuthStore } from "@/lib/auth/store";
import { performCheckIn } from "@/lib/attendance/checkin-service";
import { simulatedReading } from "@/lib/demo/simulate";
import { lagosTime } from "@/lib/time/zone";
import type { Repository } from "@/lib/repo/interfaces";
import type { User } from "@/lib/repo/types";

const seed = buildSeed();
const venue = seed.venues[0];
const SAT = "mtg-2026-11-07-sat";
let repo: Repository;
let adebayo: User;

const body = (preset: "AT_VENUE" | "FAR_AWAY" | "POOR_ACCURACY", deviceId = "device-adebayo-0001") => {
  const r = simulatedReading(preset, venue)!;
  return { latitude: r.lat, longitude: r.lng, accuracy: r.accuracyM, deviceId };
};

beforeEach(async () => {
  repo = createJsonMockRepository(seed);
  resetAuthStore();
  adebayo = (await repo.users.get(seed.demo.adebayo))!;
});

describe("geolocation check-in (spec 6.1, 6.2)", () => {
  it("records On time at 09:20 inside the radius and counts it straight away", async () => {
    const r = await performCheckIn(repo, adebayo, SAT, body("AT_VENUE"), lagosTime(2026, 11, 7, 9, 20));
    expect(r).toMatchObject({ ok: true, status: "ON_TIME", flagged: false });
    if (r.ok) {
      expect(r.distanceM).toBe(25);
      expect(r.percent).toBe(88.2); // 45 of 51
    }
    const rec = await repo.records.findFirst({ meetingId: SAT, userId: adebayo.id });
    expect(rec).toMatchObject({ status: "ON_TIME", method: "GEO", deviceId: "device-adebayo-0001" });
  });

  it("records Late at 09:31", async () => {
    expect(await performCheckIn(repo, adebayo, SAT, body("AT_VENUE"), lagosTime(2026, 11, 7, 9, 31))).toMatchObject({
      ok: true,
      status: "LATE",
    });
  });

  it("refuses 2 km away with the distance, and poor accuracy", async () => {
    const far = await performCheckIn(repo, adebayo, SAT, body("FAR_AWAY"), lagosTime(2026, 11, 7, 9, 20));
    expect(far).toMatchObject({ ok: false, code: "OUT_OF_RANGE" });
    if (!far.ok) expect(far.distanceM).toBeGreaterThan(1990);
    expect(
      await performCheckIn(repo, adebayo, SAT, body("POOR_ACCURACY"), lagosTime(2026, 11, 7, 9, 20)),
    ).toMatchObject({ ok: false, code: "LOW_ACCURACY" });
    expect(await repo.records.findFirst({ meetingId: SAT, userId: adebayo.id })).toBeNull();
  });

  it("refuses before 08:30 and after 11:30, and a second check-in", async () => {
    expect(await performCheckIn(repo, adebayo, SAT, body("AT_VENUE"), lagosTime(2026, 11, 7, 8, 25))).toMatchObject({
      code: "WINDOW_NOT_OPEN",
    });
    expect(await performCheckIn(repo, adebayo, SAT, body("AT_VENUE"), lagosTime(2026, 11, 7, 11, 31))).toMatchObject({
      code: "WINDOW_CLOSED",
    });
    await performCheckIn(repo, adebayo, SAT, body("AT_VENUE"), lagosTime(2026, 11, 7, 9, 0));
    expect(await performCheckIn(repo, adebayo, SAT, body("AT_VENUE"), lagosTime(2026, 11, 7, 9, 5))).toMatchObject({
      code: "ALREADY_CHECKED_IN",
    });
  });

  it("does not ask Remote members to check in on Saturdays, and refuses sheet meetings", async () => {
    const ruth = (await repo.users.get(seed.demo.ruth))!;
    expect(await performCheckIn(repo, ruth, SAT, body("AT_VENUE"), lagosTime(2026, 11, 7, 9, 20))).toMatchObject({
      code: "REMOTE_MEMBER",
    });
    expect(
      await performCheckIn(repo, adebayo, "mtg-2026-11-12-thu", body("AT_VENUE"), lagosTime(2026, 11, 12, 20, 0)),
    ).toMatchObject({ code: "NOT_GEO" });
  });

  it("flags (but saves) a check-in from a device another account used for the same meeting", async () => {
    const chioma = (await repo.users.get(seed.demo.chioma))!;
    await performCheckIn(repo, chioma, SAT, body("AT_VENUE", "shared-phone-0001"), lagosTime(2026, 11, 7, 9, 10));
    const r = await performCheckIn(
      repo,
      adebayo,
      SAT,
      body("AT_VENUE", "shared-phone-0001"),
      lagosTime(2026, 11, 7, 9, 12),
    );
    expect(r).toMatchObject({ ok: true, flagged: true });
    const rec = await repo.records.findFirst({ meetingId: SAT, userId: adebayo.id });
    expect(rec!.flagReason).toMatch(/another account/);
  });

  it("creates a weekly meeting that is not stored yet, on first check-in", async () => {
    const id = "mtg-2026-11-21-sat";
    expect(await repo.meetings.get(id)).toBeNull();
    const r = await performCheckIn(repo, adebayo, id, body("AT_VENUE"), lagosTime(2026, 11, 21, 9, 15));
    expect(r).toMatchObject({ ok: true, status: "ON_TIME" });
    expect(await repo.meetings.get(id)).toMatchObject({ type: "SATURDAY", status: "SCHEDULED" });
  });

  it("returns NOT_FOUND for an unknown meeting", async () => {
    expect(
      await performCheckIn(repo, adebayo, "mtg-nope", body("AT_VENUE"), lagosTime(2026, 11, 7, 9, 20)),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});
