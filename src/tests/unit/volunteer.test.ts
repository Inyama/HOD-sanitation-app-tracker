// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createJsonMockRepository } from "@/lib/repo/json-mock";
import { buildSeed } from "@/data/seed";
import { resetAuthStore } from "@/lib/auth/store";
import { buildDutyBoard, canWithdraw, arrivalTime } from "@/lib/volunteer/duties";
import { autoHoursFor, hoursByMonth, summarizeHours, verifiedHoursInYear } from "@/lib/volunteer/hours";
import { liveLists } from "@/lib/volunteer/marshal";
import {
  addManualHours,
  decideSwap,
  manualCheckIn,
  requestSwap,
  sendEncouragement,
  signUpForDuty,
  teamStats,
  upcomingSaturdays,
  withdrawFromDuty,
} from "@/lib/volunteer/service";
import { performCheckIn } from "@/lib/attendance/checkin-service";
import { simulatedReading } from "@/lib/demo/simulate";
import { lagosTime } from "@/lib/time/zone";
import type { Repository } from "@/lib/repo/interfaces";
import type { ServiceHour } from "@/lib/repo/types";

const seed = buildSeed();
const SAT = "mtg-2026-11-07-sat";
const SAT14 = "mtg-2026-11-14-sat";
const fri = lagosTime(2026, 11, 6, 10, 0);
let repo: Repository;
const get = async (key: string) => (await repo.users.get(seed.demo[key]))!;

beforeEach(() => {
  repo = createJsonMockRepository(seed);
  resetAuthStore();
});

describe("duty board rules", () => {
  it("counts spots per zone and shows my duty", () => {
    const board = buildDutyBoard(seed.zones, seed.duties, SAT, seed.demo.grace);
    expect(board.map((z) => [z.name, z.capacity])).toEqual([
      ["Sanctuary", 5],
      ["Restrooms", 3],
      ["Entrance", 3],
      ["Kitchen", 3],
      ["Outdoors", 4],
    ]);
    expect(board.reduce((s, z) => s + z.taken, 0)).toBe(12);
    expect(board.filter((z) => z.mine)).toHaveLength(1);
  });
  it("frees a spot when a swap is approved (SWAPPED)", () => {
    const duties = seed.duties.map((d) => (d.meetingId === SAT ? { ...d, status: "SWAPPED" as const } : d));
    expect(buildDutyBoard(seed.zones, duties, SAT, "x").every((z) => z.taken === 0)).toBe(true);
  });
  it("allows withdrawing only until 12 hours before", () => {
    const start = lagosTime(2026, 11, 7, 9, 30).toISO()!;
    expect(canWithdraw(lagosTime(2026, 11, 6, 21, 29), start)).toEqual({ ok: true });
    expect(canWithdraw(lagosTime(2026, 11, 6, 21, 31), start)).toEqual({ ok: false, reason: "TOO_LATE_TO_WITHDRAW" });
    expect(canWithdraw(lagosTime(2026, 11, 7, 9, 31), start)).toEqual({ ok: false, reason: "MEETING_PAST" });
  });
  it("sets arrival by zone", () => {
    expect(
      arrivalTime(lagosTime(2026, 11, 7, 9, 30).toISO()!, "Kitchen")
        .setZone("Africa/Lagos")
        .toFormat("HH:mm"),
    ).toBe("09:00");
    expect(
      arrivalTime(lagosTime(2026, 11, 7, 9, 30).toISO()!, "Sanctuary")
        .setZone("Africa/Lagos")
        .toFormat("HH:mm"),
    ).toBe("09:15");
  });
});

describe("duty actions", () => {
  it("lists the next two Saturdays", async () => {
    expect((await upcomingSaturdays(repo, fri)).map((m) => m.id)).toEqual([SAT, SAT14]);
  });

  it("signs up, refuses a second zone and a full zone, then withdraws", async () => {
    const tobi = await get("tobi");
    const kitchen = "zone-kitchen";
    expect(await signUpForDuty(repo, tobi, SAT14, kitchen, fri)).toMatchObject({ ok: true });
    expect(await signUpForDuty(repo, tobi, SAT14, "zone-entrance", fri)).toMatchObject({
      ok: false,
      code: "ALREADY_ON_DUTY",
    });
    // Fill the Kitchen (capacity 3) and check a fourth person is refused.
    const others = seed.users
      .filter((u) => u.status === "ACTIVE" && u.role !== "ADMIN" && !seed.duties.some((d) => d.userId === u.id))
      .slice(0, 4);
    for (const u of others.slice(0, 3)) await signUpForDuty(repo, u, SAT14, kitchen, fri);
    expect(await signUpForDuty(repo, others[3], SAT14, kitchen, fri)).toMatchObject({ ok: false, code: "ZONE_FULL" });
    const mine = (await repo.duties.list({ where: { userId: tobi.id, meetingId: SAT14 } }))[0];
    expect(await withdrawFromDuty(repo, tobi, mine.id, fri)).toEqual({ ok: true });
  });

  it("requires a swap after the cut-off, approved by the Team Lead only", async () => {
    const grace = await get("grace");
    const teamMember = seed.teamMembers.find((m) => m.teamId === "team-sanctuary-a" && m.userId !== grace.id)!;
    const member = (await repo.users.get(teamMember.userId))!;
    const late = lagosTime(2026, 11, 7, 6, 0);
    const res = await signUpForDuty(repo, member, SAT, "zone-entrance", fri);
    if (!res.ok) {
      // Already on duty for that Saturday in the seed: use that duty instead.
      expect(res.code).toBe("ALREADY_ON_DUTY");
    }
    const duty = (await repo.duties.list({ where: { userId: member.id, meetingId: SAT } }))[0];
    expect(await withdrawFromDuty(repo, member, duty.id, late)).toMatchObject({
      ok: false,
      code: "TOO_LATE_TO_WITHDRAW",
    });
    expect(await requestSwap(repo, member, duty.id, late)).toMatchObject({ ok: true });
    const michael = await get("michael");
    expect(await decideSwap(repo, michael, duty.id, true)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await decideSwap(repo, grace, duty.id, true)).toMatchObject({ ok: true, duty: { status: "SWAPPED" } });
    expect(await repo.audit.count({ where: { action: "DUTY_SWAP_APPROVED" } })).toBe(1);
  });
});

describe("service hours", () => {
  const h = (hours: number, iso: string, source: "AUTO" | "MANUAL", verified = false): ServiceHour => ({
    id: iso + hours,
    userId: "u",
    meetingId: null,
    hours,
    source,
    verifiedById: verified ? "admin" : null,
    createdAt: iso,
    note: null,
  });
  const list = [
    h(2, "2026-11-01T10:00:00Z", "AUTO"),
    h(3, "2026-11-03T10:00:00Z", "MANUAL", true),
    h(1.5, "2026-11-04T10:00:00Z", "MANUAL"),
    h(2, "2026-10-10T10:00:00Z", "AUTO"),
  ];

  it("summarises verified and pending hours", () => {
    expect(summarizeHours(list, fri)).toEqual({ thisMonth: 5, thisYear: 7, allTime: 7, pending: 1.5 });
    expect(verifiedHoursInYear(list, 2026)).toBe(7);
  });
  it("groups by month", () => {
    const months = hoursByMonth(list, fri, 2);
    expect(months).toEqual([
      { month: "2026-10", label: "Oct", verified: 2, pending: 0 },
      { month: "2026-11", label: "Nov", verified: 5, pending: 1.5 },
    ]);
  });
  it("gives automatic hours by meeting length", () => {
    expect(autoHoursFor({ startsAt: "2026-11-07T08:30:00Z", endsAt: "2026-11-07T10:30:00Z" })).toBe(2);
    expect(autoHoursFor({ startsAt: "2026-11-28T06:30:00Z", endsAt: "2026-11-28T11:30:00Z" })).toBe(5);
    expect(autoHoursFor({ startsAt: "2026-11-07T08:30:00Z", endsAt: null })).toBe(2);
  });
  it("validates manual entries", async () => {
    const grace = await get("grace");
    expect(
      await addManualHours(repo, grace, { date: "2026-11-05", hours: 2, note: "Supplies run" }, fri),
    ).toMatchObject({ ok: true, entry: { source: "MANUAL", verifiedById: null } });
    expect(await addManualHours(repo, grace, { date: "2026-11-09", hours: 2, note: "Future" }, fri)).toMatchObject({
      ok: false,
    });
    expect(await addManualHours(repo, grace, { date: "2026-08-01", hours: 2, note: "Too old" }, fri)).toMatchObject({
      ok: false,
    });
  });
  it("adds automatic hours when a volunteer checks in, once per meeting", async () => {
    const michael = await get("michael");
    const r = simulatedReading("AT_VENUE", seed.venues[0])!;
    await performCheckIn(
      repo,
      michael,
      SAT,
      { latitude: r.lat, longitude: r.lng, accuracy: r.accuracyM, deviceId: "michael-phone-0001" },
      lagosTime(2026, 11, 7, 9, 10),
    );
    const auto = await repo.serviceHours.list({ where: { userId: michael.id, meetingId: SAT } });
    expect(auto).toHaveLength(1);
    expect(auto[0]).toMatchObject({ source: "AUTO", hours: 2 });
    // Members do not get hours.
    const adebayo = await get("adebayo");
    await performCheckIn(
      repo,
      adebayo,
      SAT,
      { latitude: r.lat, longitude: r.lng, accuracy: r.accuracyM, deviceId: "adebayo-phone-0001" },
      lagosTime(2026, 11, 7, 9, 11),
    );
    expect(await repo.serviceHours.count({ where: { userId: adebayo.id } })).toBe(0);
  });
});

describe("marshal", () => {
  it("splits people into present, late and expected", () => {
    const meeting = seed.meetings.find((m) => m.id === "mtg-2026-10-31-sat")!;
    const lists = liveLists(meeting, seed.users, seed.records);
    const recs = seed.records.filter((r) => r.meetingId === meeting.id);
    expect(lists.present.length).toBe(recs.filter((r) => r.status === "ON_TIME").length);
    expect(lists.late.length).toBe(recs.filter((r) => r.status === "LATE").length);
    expect(lists.expected.some((p) => p.userId === seed.demo.ruth)).toBe(false); // remote
    expect(lists.expected.some((p) => p.userId === seed.demo.samuel)).toBe(false); // pending
  });

  it("records a manual check-in flagged for review, with the server's status", async () => {
    const grace = await get("grace");
    const r = await manualCheckIn(
      repo,
      grace,
      SAT,
      seed.demo.chioma,
      "Phone battery flat",
      lagosTime(2026, 11, 7, 9, 45),
    );
    expect(r).toMatchObject({
      ok: true,
      record: { status: "LATE", method: "MANUAL", flagged: true, recordedById: grace.id },
    });
    expect(
      await manualCheckIn(repo, grace, SAT, seed.demo.chioma, "again", lagosTime(2026, 11, 7, 9, 46)),
    ).toMatchObject({ code: "ALREADY_CHECKED_IN" });
    expect(await manualCheckIn(repo, grace, SAT, grace.id, "me", lagosTime(2026, 11, 7, 9, 46))).toMatchObject({
      code: "SELF",
    });
    expect(await manualCheckIn(repo, grace, SAT, seed.demo.ngozi, "early", lagosTime(2026, 11, 7, 8, 0))).toMatchObject(
      { code: "WINDOW_NOT_OPEN" },
    );
    expect(await repo.audit.count({ where: { action: "MANUAL_CHECK_IN" } })).toBe(1);
  });
});

describe("team view and encouragement", () => {
  it("shows a Team Lead only their team, with percentages and last five meetings", async () => {
    const grace = await get("grace");
    const teams = await teamStats(repo, grace, fri);
    expect(teams.map((t) => t.name)).toEqual(["Sanctuary A"]);
    const lead = teams[0].members.find((m) => m.isLead)!;
    expect(lead).toMatchObject({ id: grace.id, percent: 94 });
    expect(lead.last).toHaveLength(5);
  });

  it("sends encouragement once a day, only within the team", async () => {
    const grace = await get("grace");
    const teams = await teamStats(repo, grace, fri);
    const someone = teams[0].members.find((m) => !m.isLead)!;
    expect(await sendEncouragement(repo, grace, someone.id, fri)).toMatchObject({ ok: true });
    expect(await sendEncouragement(repo, grace, someone.id, fri.plus({ hours: 2 }))).toMatchObject({
      ok: false,
      code: "ALREADY_SENT",
    });
    expect(await sendEncouragement(repo, grace, someone.id, fri.plus({ hours: 25 }))).toMatchObject({ ok: true });
    expect(await sendEncouragement(repo, grace, seed.demo.chioma, fri)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await repo.notifications.count({ where: { userId: someone.id, type: "ENCOURAGEMENT" } })).toBe(2);
  });
});
