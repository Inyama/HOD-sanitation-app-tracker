import { beforeAll, describe, expect, it } from "vitest";
import { buildSeed, CANCELLED_SATURDAY, PREVIEW_MEETING_ID, SEED_NOW, type SeedData } from "@/data/seed";
import { attendanceViews, countedMeetings, currentStreak } from "@/lib/attendance/aggregate";
import { MEETING_ZONE } from "@/lib/time/zone";
import { DateTime } from "luxon";

let s: SeedData;
beforeAll(() => {
  s = buildSeed();
});

const view = (key: string) => {
  const u = s.users.find((x) => x.id === s.demo[key])!;
  const recs = s.records.filter((r) => r.userId === u.id);
  return {
    u,
    recs,
    v: attendanceViews(recs, s.meetings, { approvedAt: u.approvedAt, now: SEED_NOW }),
    counted: countedMeetings(recs, s.meetings, { approvedAt: u.approvedAt, now: SEED_NOW }),
  };
};

describe("seed is deterministic (mulberry32, seed 20261106)", () => {
  it("builds identical data twice", () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(s));
  });
});

describe("volumes (spec 10.2)", () => {
  it("has 64 people: 47 members, 12 volunteers, 5 admins with one of each level", () => {
    expect(s.users).toHaveLength(64);
    const roles = s.users.reduce<Record<string, number>>((a, u) => ((a[u.role] = (a[u.role] ?? 0) + 1), a), {});
    expect(roles).toEqual({ MEMBER: 47, VOLUNTEER: 12, ADMIN: 5 });
    expect(
      s.users
        .filter((u) => u.adminLevel)
        .map((u) => u.adminLevel)
        .sort(),
    ).toEqual(["ATTENDANCE_OFFICER", "AUDITOR", "COMMS_OFFICER", "SUPER", "UNIT"]);
    expect(s.users.every((u) => u.email.endsWith("example.com"))).toBe(true);
    expect(new Set(s.users.map((u) => u.email)).size).toBe(64);
  });

  it("staggers approvals: 40 a year ago, 14 six months ago, 6 recent and 4 pending", () => {
    const yearAgo = s.users.filter((u) => u.approvedAt && u.approvedAt < "2026-01-01").length;
    const half = s.users.filter(
      (u) => u.approvedAt && u.approvedAt >= "2026-04-01" && u.approvedAt < "2026-09-01",
    ).length;
    const recent = s.users.filter((u) => u.approvedAt && u.approvedAt >= "2026-09-01").length;
    expect([yearAgo, half, recent]).toEqual([40, 14, 6]);
    expect(s.users.filter((u) => u.status === "PENDING")).toHaveLength(4);
  });

  it("has 5 zones and 6 teams each with a lead and 8 to 12 people", () => {
    expect(s.zones.map((z) => z.name)).toEqual(["Sanctuary", "Restrooms", "Entrance", "Kitchen", "Outdoors"]);
    expect(s.teams).toHaveLength(6);
    for (const t of s.teams) {
      const members = s.teamMembers.filter((m) => m.teamId === t.id).map((m) => m.userId);
      expect(members).toContain(t.leadUserId);
      expect(members.length).toBeGreaterThanOrEqual(8);
      expect(members.length).toBeLessThanOrEqual(12);
    }
  });

  it("has 52 past meetings (one Saturday cancelled) and the upcoming meetings", () => {
    const past = s.meetings.filter((m) => DateTime.fromISO(m.startsAt) < SEED_NOW);
    expect(past.filter((m) => m.type === "SATURDAY")).toHaveLength(26);
    expect(past.filter((m) => m.type === "THURSDAY_PRAYER")).toHaveLength(26);
    expect(
      past
        .filter((m) => m.status === "CANCELLED")
        .map((m) => DateTime.fromISO(m.startsAt).setZone(MEETING_ZONE).toISODate()),
    ).toEqual([CANCELLED_SATURDAY]);
    const upcoming = s.meetings.filter((m) => DateTime.fromISO(m.startsAt) > SEED_NOW);
    expect(
      upcoming.map((m) => `${m.type} ${DateTime.fromISO(m.startsAt).setZone(MEETING_ZONE).toFormat("dd LLL HH:mm")}`),
    ).toEqual([
      "SATURDAY 07 Nov 09:30",
      "THURSDAY_PRAYER 12 Nov 20:30",
      "SATURDAY 14 Nov 09:30",
      "SPECIAL 17 Nov 10:00",
      "SPECIAL 28 Nov 07:30",
    ]);
    expect(upcoming.filter((m) => m.type === "SPECIAL").map((m) => m.title)).toEqual([
      "Training Morning",
      "Deep Clean Day",
    ]);
  });

  it("has about 3,000 records with roughly the target distribution", () => {
    expect(s.records.length).toBeGreaterThan(2500);
    expect(s.records.length).toBeLessThan(3200);
    const share = (st: string) => s.records.filter((r) => r.status === st).length / s.records.length;
    expect(share("ON_TIME")).toBeGreaterThan(0.57);
    expect(share("ON_TIME")).toBeLessThan(0.67);
    expect(share("LATE")).toBeGreaterThan(0.1);
    expect(share("LATE")).toBeLessThan(0.18);
    expect(share("ABSENT")).toBeGreaterThan(0.13);
    expect(share("ABSENT")).toBeLessThan(0.21);
    expect(share("EXCUSED")).toBeGreaterThan(0.03);
    expect(share("EXCUSED")).toBeLessThan(0.09);
  });

  it("has the other volumes", () => {
    expect(s.messages).toHaveLength(12);
    expect(s.excuses).toHaveLength(8);
    expect(new Set(s.excuses.map((e) => e.status))).toEqual(new Set(["PENDING", "APPROVED", "DECLINED"]));
    expect(s.issues).toHaveLength(10);
    expect(s.issues.filter((i) => i.status === "OPEN" && i.urgency === "URGENT")).toHaveLength(3);
    expect(s.duties).toHaveLength(20);
    expect(s.uploads.map((u) => u.status)).toEqual(["CONFIRMED", "CONFIRMED", "PREVIEW"]);
    expect(s.auditLogs).toHaveLength(25);
    expect(s.announcements).toHaveLength(4);
    expect(s.announcements.filter((a) => a.pinned)).toHaveLength(1);
    const perUser = s.notifications.reduce<Record<string, number>>(
      (a, n) => ((a[n.userId] = (a[n.userId] ?? 0) + 1), a),
      {},
    );
    const active = s.users.filter((u) => u.status === "ACTIVE");
    for (const u of active) {
      expect(perUser[u.id] ?? 0).toBeGreaterThanOrEqual(5);
      expect(perUser[u.id] ?? 0).toBeLessThanOrEqual(15);
    }
    expect(s.notifications.some((n) => n.readAt)).toBe(true);
    expect(s.notifications.some((n) => !n.readAt && n.channel === "IN_APP")).toBe(true);
    expect(new Set(s.notifications.map((n) => n.dedupeKey)).size).toBe(s.notifications.length);
  });
});

describe("demo accounts land on their planted targets (spec 10.4, within 0.5)", () => {
  it.each([
    ["adebayo", 88],
    ["chioma", 52],
    ["ngozi", 90],
    ["emeka", 89.7],
    ["grace", 94],
    ["michael", 71],
  ])("%s is %s percent", (key, target) => {
    const pct = view(key).v.overall.percent!;
    expect(Math.abs(pct - target)).toBeLessThanOrEqual(0.5);
  });

  it("Ngozi is exactly 90.0 (gold) and Emeka 89.7 (just under)", () => {
    expect(view("ngozi").v.overall).toMatchObject({ percent: 90, band: { key: "gold" } });
    expect(view("emeka").v.overall).toMatchObject({ percent: 89.7, band: { key: "green" } });
  });

  it("Adebayo has a 6-meeting streak and exactly 2 badges", () => {
    const a = view("adebayo");
    expect(currentStreak(a.counted)).toBe(6);
    expect(
      s.userBadges
        .filter((b) => b.userId === s.demo.adebayo)
        .map((b) => b.badgeId)
        .sort(),
    ).toEqual(["badge-on_time_10", "badge-perfect_month"]);
  });

  it("Chioma is amber, has a low-attendance nudge and a pending excuse", () => {
    expect(view("chioma").v.overall.band.key).toBe("amber");
    expect(s.notifications.some((n) => n.userId === s.demo.chioma && n.type === "LOW_ATTENDANCE")).toBe(true);
    expect(s.excuses.some((e) => e.userId === s.demo.chioma && e.status === "PENDING")).toBe(true);
  });

  it("Tobi joined 3 weeks ago and has 5 meetings counted from approval", () => {
    const t = view("tobi");
    expect(t.u.approvedAt!.slice(0, 10)).toBe("2026-10-16");
    expect(t.counted).toHaveLength(5);
  });

  it("Ruth is Remote in London with Thursday records only", () => {
    const r = view("ruth");
    expect(r.u.isRemote).toBe(true);
    expect(r.u.timezone).toBe("Europe/London");
    expect(new Set(r.recs.map((x) => s.meetings.find((m) => m.id === x.meetingId)!.type))).toEqual(
      new Set(["THURSDAY_PRAYER"]),
    );
  });

  it("Grace is Team Lead and Marshal with 31 service hours; Michael is Supplies Keeper", () => {
    const titles = (id: string) =>
      s.userTitles
        .filter((t) => t.userId === id)
        .map((t) => t.title)
        .sort();
    expect(titles(s.demo.grace)).toEqual(["MARSHAL", "TEAM_LEAD"]);
    expect(titles(s.demo.michael)).toEqual(["SUPPLIES_KEEPER"]);
    const verified = s.serviceHours.filter((h) => h.userId === s.demo.grace && (h.source === "AUTO" || h.verifiedById));
    expect(verified.reduce((a, h) => a + h.hours, 0)).toBe(31);
  });

  it("Samuel is pending with no records and Victor is suspended", () => {
    expect(view("samuel").u.status).toBe("PENDING");
    expect(view("samuel").recs).toHaveLength(0);
    expect(view("victor").u.status).toBe("SUSPENDED");
  });
});

describe("scenario coverage (spec 10.5)", () => {
  it("has a flagged check-in with 48 m accuracy on a shared device", () => {
    const flagged = s.records.find((r) => r.flagged && r.method === "GEO")!;
    expect(flagged.accuracyM).toBe(48);
    const sharer = s.records.filter((r) => r.meetingId === flagged.meetingId && r.deviceId === flagged.deviceId);
    expect(sharer.map((r) => r.userId)).toHaveLength(2);
  });

  it("has no records for the cancelled Saturday", () => {
    const cancelled = s.meetings.find((m) => m.status === "CANCELLED")!;
    expect(s.records.filter((r) => r.meetingId === cancelled.id)).toHaveLength(0);
  });

  it("keeps Thursday 5 November in Preview with exactly 3 exceptions", () => {
    expect(s.records.filter((r) => r.meetingId === PREVIEW_MEETING_ID)).toHaveLength(0);
    const preview = s.uploads.find((u) => u.status === "PREVIEW")!;
    expect(preview.rowsException).toBe(3);
    const rows = s.uploadRows.filter((r) => r.uploadId === preview.id && r.matchType !== "EMAIL");
    expect(rows.map((r) => [r.matchType, r.rawName]).sort()).toEqual(
      [
        ["DUPLICATE", rows.find((r) => r.matchType === "DUPLICATE")!.rawName],
        ["NAME_SUGGESTED", "Adebayo Jonhson"],
        ["NOT_FOUND", "Kelechi Nnamdi"],
      ].sort(),
    );
    expect(rows.find((r) => r.matchType === "NAME_SUGGESTED")!.matchedUserId).toBe(s.demo.adebayo);
  });

  it("links Thursday records to their uploads and places Saturday check-ins 5 to 90 m from the venue", () => {
    expect(s.records.filter((r) => r.sourceUploadId === "upl-2026-10-22").length).toBeGreaterThan(30);
    const geo = s.records.filter((r) => r.method === "GEO" && r.distanceM !== null);
    expect(Math.min(...geo.map((r) => r.distanceM!))).toBeGreaterThanOrEqual(4.9);
    expect(Math.max(...geo.map((r) => r.distanceM!))).toBeLessThanOrEqual(90.1);
    expect(Math.max(...geo.filter((r) => !r.flagged).map((r) => r.accuracyM!))).toBeLessThanOrEqual(35);
  });

  it("has 4 pending approvals and a manual check-in awaiting review", () => {
    expect(s.users.filter((u) => u.status === "PENDING")).toHaveLength(4);
    expect(s.records.some((r) => r.method === "MANUAL" && r.flagged && r.recordedById === s.demo.grace)).toBe(true);
  });

  it("matches the sample sheets to the seeded people", () => {
    expect(s.sampleSheets.withErrors.length).toBe(s.sampleSheets.clean.length + 2);
    const emails = new Set(s.users.map((u) => u.email));
    expect(s.sampleSheets.clean.every((r) => emails.has(r.email!))).toBe(true);
  });
});
