import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { resolveRange, parseCustomRange, inRange } from "@/lib/admin/range";
import { activeAt, buildDashboard, pendingAt, type DashPerson } from "@/lib/admin/dashboard";
import {
  canRestore,
  filterMembers,
  matchesQuery,
  paginate,
  parseMemberImport,
  purgeDate,
  sortMembers,
  type MemberRow,
} from "@/lib/admin/members";
import { checkRoleChange, roleEffects } from "@/lib/admin/roles";
import { actionLabel, auditCsv, describeChange, filterAudit } from "@/lib/admin/audit";
import { settingsChanges } from "@/lib/admin/settings";
import { settingsBody } from "@/lib/validation/admin";
import { capabilities } from "@/lib/auth/permissions";
import { DEFAULT_SETTINGS } from "@/data/seed";
import type { AuditLog } from "@/lib/repo/types";

const NOW = DateTime.fromISO("2026-11-09T10:00:00", { zone: "Africa/Lagos" }).toUTC();

describe("admin date range", () => {
  it("defaults to the last 12 weeks, compared with the 12 weeks before", () => {
    const r = resolveRange(undefined, NOW);
    expect(r.key).toBe("12w");
    expect(r.fromDate).toBe("2026-08-18");
    expect(r.toDate).toBe("2026-11-09");
    expect(Math.round(r.prevTo.diff(r.prevFrom, "days").days)).toBe(Math.round(r.to.diff(r.from, "days").days));
    expect(r.prevTo < r.from).toBe(true);
  });

  it("compares this month with the whole of last month", () => {
    const r = resolveRange("month", NOW);
    expect(r.fromDate).toBe("2026-11-01");
    expect(r.prevFrom.setZone("Africa/Lagos").toISODate()).toBe("2026-10-01");
    expect(r.prevTo.setZone("Africa/Lagos").toISODate()).toBe("2026-10-31");
  });

  it("names last month, quarter and year", () => {
    expect(resolveRange("lastMonth", NOW).label).toBe("Last month (October)");
    expect(resolveRange("quarter", NOW).label).toBe("This quarter (Q4)");
    expect(resolveRange("year", NOW).fromDate).toBe("2026-01-01");
  });

  it("accepts a custom range and stops it at today", () => {
    const r = resolveRange("2026-09-01..2026-12-31", NOW);
    expect(r.key).toBe("custom");
    expect(r.toDate).toBe("2026-11-09");
    expect(r.label).toBe("1 Sep to 9 Nov 2026");
  });

  it("rejects backwards, future or huge custom ranges and falls back", () => {
    expect(parseCustomRange("2026-10-10..2026-10-01", NOW)).toBeNull();
    expect(parseCustomRange("2027-01-01..2027-02-01", NOW)).toBeNull();
    expect(parseCustomRange("2020-01-01..2026-01-01", NOW)).toBeNull();
    expect(resolveRange("nonsense", NOW).key).toBe("12w");
  });

  it("tests instants against the range", () => {
    const r = resolveRange("month", NOW);
    expect(inRange("2026-11-01T00:00:00+01:00", r.from, r.to)).toBe(true);
    expect(inRange("2026-10-31T23:59:00+01:00", r.from, r.to)).toBe(false);
    expect(inRange(null, r.from, r.to)).toBe(false);
  });
});

const person = (over: Partial<DashPerson> & { id: string }): DashPerson => ({
  name: over.id,
  role: "MEMBER",
  status: "ACTIVE",
  approvedAt: "2026-01-01T00:00:00Z",
  createdAt: "2025-12-20T00:00:00Z",
  statusChangedAt: null,
  teamId: "t1",
  ...over,
});

function sat(day: string) {
  return { id: `sat-${day}`, type: "SATURDAY" as const, startsAt: `${day}T08:30:00Z`, status: "CLOSED" as const };
}

describe("admin dashboard", () => {
  const meetings = [sat("2026-10-17"), sat("2026-10-24"), sat("2026-10-31"), sat("2026-11-07")];
  const people = [
    person({ id: "a" }),
    person({ id: "b" }),
    person({ id: "c", role: "VOLUNTEER" }),
    person({ id: "p", status: "PENDING", approvedAt: null, createdAt: "2026-11-02T08:00:00Z" }),
    person({ id: "s", status: "SUSPENDED", statusChangedAt: "2026-11-03T08:00:00Z" }),
  ];
  const rec = (userId: string, i: number, status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED", min = -10) => ({
    meetingId: meetings[i].id,
    userId,
    status,
    checkedInAt:
      status === "ON_TIME" || status === "LATE"
        ? DateTime.fromISO(meetings[i].startsAt).plus({ minutes: min }).toISO()
        : null,
  });
  const records = [
    ...[0, 1, 2, 3].map((i) => rec("a", i, "ON_TIME")),
    rec("b", 0, "ABSENT"),
    rec("b", 1, "ABSENT"),
    rec("b", 2, "ABSENT"),
    rec("b", 3, "ABSENT"),
    rec("c", 0, "LATE", 20),
    rec("c", 1, "ON_TIME"),
    rec("c", 2, "EXCUSED"),
    rec("c", 3, "ON_TIME", -40),
  ];
  const dash = buildDashboard({
    now: NOW,
    range: resolveRange("4w", NOW),
    people,
    meetings,
    records,
    issues: [
      { status: "OPEN", createdAt: "2026-11-01T10:00:00Z" },
      { status: "RESOLVED", createdAt: "2026-10-01T10:00:00Z" },
    ],
    teams: [
      { id: "t1", name: "One" },
      { id: "t2", name: "Two" },
    ],
    lateWeight: 1,
    thresholds: { gold: 90, green: 75, amber: 50 },
    atRiskPercent: 60,
    atRiskAbsences: 3,
  });

  it("pools attendance of active people only (suspended and pending are left out)", () => {
    // a: 4 of 4; b: 0 of 4; c: 3 of 3 (excused removed) => 7 / 11
    expect(dash.kpis.averageAttendance.value).toBe(63.6);
    expect(dash.statusMix).toEqual({ onTime: 6, late: 1, absent: 4, excused: 1 });
    expect(dash.kpis.onTimeRate.value).toBe(85.7);
  });

  it("counts heads and their change", () => {
    expect(dash.kpis.activeMembers.value).toBe(3);
    // Suspended 3 Nov, so active at the end of the previous period: one more.
    expect(dash.kpis.activeMembers.delta).toBe(-1);
    expect(dash.kpis.volunteers.value).toBe(1);
    expect(dash.kpis.pendingApprovals).toEqual({ value: 1, delta: 1 });
    expect(dash.kpis.openIssues.value).toBe(1);
  });

  it("lists at-risk people with the reason", () => {
    expect(dash.atRisk.map((x) => [x.id, x.reason])).toEqual([["b", "4 absences in a row"]]);
  });

  it("needs eight meetings for the top 10", () => {
    expect(dash.topConsistent).toEqual([]);
  });

  it("puts arrivals in 15-minute slots around the start", () => {
    const row = dash.arrivals.rows.find((r) => r.label === "Saturday")!;
    const at = (label: string) => row.cells[dash.arrivals.columns.indexOf(label)];
    expect(at("−15")).toBe(5); // a x4 and c once, 10 min early
    expect(at("−45")).toBe(1); // c, 40 min early
    expect(at("+15")).toBe(1); // c, 20 min late
  });

  it("builds a 12-week trend and team bars", () => {
    expect(dash.weeklyTrend).toHaveLength(12);
    expect(dash.weeklyTrend.at(-1)!.attendance).toBe(66.7);
    expect(dash.byTeam[0]).toMatchObject({ team: "One", attendance: 63.6, people: 3 });
    expect(dash.byTeam[1].attendance).toBeNull();
  });

  it("knows when someone was active or pending", () => {
    const s = people.find((p) => p.id === "s")!;
    expect(activeAt(s, DateTime.fromISO("2026-11-01T00:00:00Z"))).toBe(true);
    expect(activeAt(s, DateTime.fromISO("2026-11-05T00:00:00Z"))).toBe(false);
    const p = people.find((x) => x.id === "p")!;
    expect(pendingAt(p, DateTime.fromISO("2026-11-01T00:00:00Z"))).toBe(false);
    expect(pendingAt(p, NOW)).toBe(true);
  });
});

const row = (over: Partial<MemberRow> & { id: string; name: string }): MemberRow => ({
  email: `${over.id}@example.com`,
  phone: null,
  role: "MEMBER",
  adminLevel: null,
  status: "ACTIVE",
  isRemote: false,
  city: null,
  country: null,
  teamId: null,
  teamName: null,
  titles: [],
  percent: null,
  bandKey: "none",
  bandLabel: "No meetings yet",
  createdAt: "2026-01-01T00:00:00Z",
  approvedAt: "2026-01-01T00:00:00Z",
  lastLoginAt: null,
  statusChangedAt: null,
  statusReason: null,
  emailVerified: true,
  deletionRequestedAt: null,
  ...over,
});

describe("members directory", () => {
  const rows = [
    row({ id: "1", name: "Adébayo Johnson", percent: 88, bandKey: "green", teamId: "t1", phone: "+234 803 111 2222" }),
    row({ id: "2", name: "Chioma Eze", percent: 52, bandKey: "amber", role: "VOLUNTEER", isRemote: true }),
    row({ id: "3", name: "Victor Nwosu", status: "SUSPENDED", percent: null }),
  ];

  it("searches by name without accents or word order, email and phone", () => {
    expect(matchesQuery(rows[0], "johnson adebayo")).toBe(true);
    expect(matchesQuery(rows[1], "2@example")).toBe(true);
    expect(matchesQuery(rows[0], "1112222")).toBe(true);
    expect(matchesQuery(rows[0], "chioma")).toBe(false);
  });

  it("filters by role, status, team, band and remote", () => {
    expect(filterMembers(rows, { role: "VOLUNTEER" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterMembers(rows, { status: "SUSPENDED" }).map((r) => r.id)).toEqual(["3"]);
    expect(filterMembers(rows, { teamId: "NONE" }).map((r) => r.id)).toEqual(["2", "3"]);
    expect(filterMembers(rows, { teamId: "t1" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterMembers(rows, { band: "amber" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterMembers(rows, { remote: "YES" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("sorts with missing values last and pages safely", () => {
    expect(sortMembers(rows, "percent", "desc").map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(sortMembers(rows, "percent", "asc").map((r) => r.id)).toEqual(["2", "1", "3"]);
    const p = paginate([1, 2, 3, 4, 5], 9, 2);
    expect(p).toMatchObject({ page: 3, pages: 3, items: [5], total: 5 });
  });

  it("keeps removed accounts restorable for 30 days, but not declined sign-ups", () => {
    const removed = { status: "REMOVED" as const, statusChangedAt: "2026-10-20T10:00:00Z", statusReason: "Moved away" };
    expect(purgeDate(removed)!.toISODate()).toBe("2026-11-19");
    expect(canRestore(removed, NOW)).toBe(true);
    expect(canRestore({ ...removed, statusChangedAt: "2026-09-01T10:00:00Z" }, NOW)).toBe(false);
    expect(canRestore({ ...removed, statusReason: "Rejected: not in the unit" }, NOW)).toBe(false);
  });
});

describe("member CSV import", () => {
  const teams = [{ id: "team-kitchen", name: "Kitchen" }];
  const existing = new Set(["taken@example.com"]);

  it("reads valid rows with header aliases, a byte order mark and defaults", () => {
    const csv =
      "﻿Full Name,Email Address,Phone,Role,Team,City,Country,Remote\nAda Obi,ADA@example.com,+234 801 234 5678,volunteer,kitchen,Lagos,Nigeria,no\nBen Uche,ben@example.com,,,,,,yes\n";
    const p = parseMemberImport(csv, { existingEmails: existing, teams });
    expect(p.errors).toEqual([]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toMatchObject({
      line: 2,
      email: "ada@example.com",
      role: "VOLUNTEER",
      teamId: "team-kitchen",
      isRemote: false,
    });
    expect(p.rows[1]).toMatchObject({ role: "MEMBER", teamId: null, isRemote: true, phone: null });
  });

  it("reports every problem with its line", () => {
    const csv = [
      "name,email,role,team,remote,phone",
      "A,a@example.com,member,,,",
      "Taken Person,taken@example.com,member,,,",
      "Bad Email,not-an-email,member,,,",
      "Bad Role,r@example.com,leader,,,",
      "Bad Team,t@example.com,member,Choir,,",
      "Bad Remote,m@example.com,member,,sometimes,",
      "Bad Phone,ph@example.com,member,,,call me",
      "First Copy,dup@example.com,member,,,",
      "Second Copy,dup@example.com,member,,,",
    ].join("\n");
    const p = parseMemberImport(csv, { existingEmails: existing, teams });
    expect(p.rows.map((r) => r.email)).toEqual(["dup@example.com"]);
    expect(p.errors.map((e) => [e.line, e.field])).toEqual([
      [2, "name"],
      [3, "email"],
      [4, "email"],
      [5, "role"],
      [6, "team"],
      [7, "remote"],
      [8, "phone"],
      [10, "email"],
    ]);
    expect(p.errors.at(-1)!.message).toBe("dup@example.com is also on line 9.");
  });

  it("refuses files without name and email columns", () => {
    expect(parseMemberImport("first,last\nA,B", { existingEmails: existing, teams }).fatal).toMatch(/name and email/);
    expect(parseMemberImport("", { existingEmails: existing, teams }).fatal).toBe("The file is empty.");
  });
});

describe("roles and titles", () => {
  const superCaps = capabilities({ role: "ADMIN", adminLevel: "SUPER", status: "ACTIVE", titles: [] });
  const unitCaps = capabilities({ role: "ADMIN", adminLevel: "UNIT", status: "ACTIVE", titles: [] });
  const member = { id: "m", status: "ACTIVE" as const, role: "MEMBER" as const, adminLevel: null, titles: [] };

  it("describes what a member gains as a volunteer marshal", () => {
    const e = roleEffects(member, { role: "VOLUNTEER", adminLevel: null, titles: ["MARSHAL"] });
    expect(e.gains).toEqual(
      expect.arrayContaining(["Duty board", "Service hours", "Marshal tools (live lists, manual check-in)"]),
    );
    expect(e.losses).toEqual([]);
    expect(e.titlesAdded).toEqual(["MARSHAL"]);
    expect(e.summary[0]).toBe("Member becomes Volunteer.");
  });

  it("drops titles and tools when a volunteer becomes a member", () => {
    const e = roleEffects(
      { role: "VOLUNTEER", adminLevel: null, titles: ["TEAM_LEAD"] },
      { role: "MEMBER", adminLevel: null, titles: ["TEAM_LEAD"] },
    );
    expect(e.losses).toEqual(expect.arrayContaining(["Team view", "Duty board"]));
    expect(e.titlesRemoved).toEqual(["TEAM_LEAD"]);
  });

  it("enforces who may change what", () => {
    const vol = { role: "VOLUNTEER" as const, adminLevel: null, titles: [] };
    expect(checkRoleChange({ id: "u", caps: unitCaps }, member, vol, 1)).toBeNull();
    expect(checkRoleChange({ id: "m", caps: unitCaps }, member, vol, 1)).toBe("SELF");
    expect(checkRoleChange({ id: "u", caps: unitCaps }, member, member, 1)).toBe("NO_CHANGE");
    expect(checkRoleChange({ id: "u", caps: unitCaps }, { ...member, status: "PENDING" }, vol, 1)).toBe("NOT_ACTIVE");
    const admin = {
      id: "a",
      status: "ACTIVE" as const,
      role: "ADMIN" as const,
      adminLevel: "AUDITOR" as const,
      titles: [],
    };
    expect(checkRoleChange({ id: "u", caps: unitCaps }, admin, { ...admin, adminLevel: "UNIT" }, 1)).toBe(
      "NEEDS_SUPER",
    );
    expect(checkRoleChange({ id: "s", caps: superCaps }, admin, { ...admin, adminLevel: "UNIT" }, 1)).toBeNull();
    expect(
      checkRoleChange({ id: "s", caps: superCaps }, member, { role: "ADMIN", adminLevel: "UNIT", titles: [] }, 1),
    ).toBe("ADMIN_BY_INVITE");
    expect(checkRoleChange({ id: "s", caps: superCaps }, admin, { ...admin, adminLevel: null }, 1)).toBe(
      "LEVEL_REQUIRED",
    );
    const onlySuper = { ...admin, id: "s2", adminLevel: "SUPER" as const };
    expect(checkRoleChange({ id: "s", caps: superCaps }, onlySuper, { ...onlySuper, adminLevel: "UNIT" }, 1)).toBe(
      "LAST_SUPER",
    );
    expect(
      checkRoleChange({ id: "s", caps: superCaps }, onlySuper, { ...onlySuper, adminLevel: "UNIT" }, 2),
    ).toBeNull();
  });
});

describe("audit log", () => {
  const rows: AuditLog[] = [
    {
      id: "1",
      actorId: "d",
      action: "USER_SUSPENDED",
      entity: "User",
      entityId: "v",
      before: { status: "ACTIVE" },
      after: { status: "SUSPENDED", reason: "No-shows" },
      ip: "1.2.3.4",
      createdAt: "2026-11-01T09:00:00Z",
    },
    {
      id: "2",
      actorId: "f",
      action: '=HYPERLINK("x")',
      entity: "Setting",
      entityId: null,
      before: null,
      after: null,
      ip: null,
      createdAt: "2026-11-05T09:00:00Z",
    },
  ];
  const names = new Map([
    ["d", "Daniel"],
    ["f", "Funke"],
    ["v", "Victor"],
  ]);

  it("labels actions, including unknown ones", () => {
    expect(actionLabel("USER_SUSPENDED")).toBe("Suspended a person");
    expect(actionLabel("SOMETHING_NEW")).toBe("Something new");
  });

  it("filters by text, person, action and Lagos dates, newest first", () => {
    expect(filterAudit(rows, { q: "victor" }, names).map((r) => r.id)).toEqual(["1"]);
    expect(filterAudit(rows, { actorId: "f" }, names).map((r) => r.id)).toEqual(["2"]);
    expect(filterAudit(rows, { from: "2026-11-02" }, names).map((r) => r.id)).toEqual(["2"]);
    expect(filterAudit(rows, {}, names).map((r) => r.id)).toEqual(["2", "1"]);
  });

  it("shows field-by-field changes", () => {
    expect(describeChange(rows[0].before, rows[0].after)).toEqual([
      { field: "status", before: "ACTIVE", after: "SUSPENDED" },
      { field: "reason", before: "–", after: "No-shows" },
    ]);
    expect(describeChange(null, null)).toEqual([]);
  });

  it("exports CSV with formula injection neutralised", () => {
    const csv = auditCsv(rows, names);
    expect(csv).toContain("Victor");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("status: ACTIVE -> SUSPENDED");
  });
});

describe("settings", () => {
  const venue = {
    name: "HOD",
    address: "7 Surulere Industrial Road",
    lat: 6.6,
    lng: 3.35,
    radiusM: 100,
    verified: false,
  };

  it("lists only what changed", () => {
    const changes = settingsChanges(
      { settings: DEFAULT_SETTINGS, venue },
      {
        settings: {
          ...DEFAULT_SETTINGS,
          lateWeight: 0.5,
          bandThresholds: { ...DEFAULT_SETTINGS.bandThresholds, gold: 92 },
        },
        venue: { ...venue, radiusM: 150 },
      },
    );
    expect(changes.map((c) => c.label)).toEqual(["Late weight", "Gold band from (%)", "Geofence radius (m)"]);
  });

  it("validates ranges and band order", () => {
    const base = {
      venue,
      maxAccuracyM: 50,
      graceMinutes: 0,
      openBeforeMinutes: 60,
      closeAfterMinutes: 120,
      lateWeight: 1,
      bandThresholds: { gold: 90, green: 75, amber: 50 },
      atRiskPercent: 60,
      atRiskConsecutiveAbsences: 3,
      lowAttendancePercent: 60,
      quietHours: { start: "22:00", end: "06:00" },
      locationRetentionMonths: 12,
      timezone: "Africa/Lagos",
      branding: { primary: "#1e40af", accent: "#d4a437", logoUrl: "/images/HOD-logo.webp" },
    };
    expect(settingsBody.safeParse(base).success).toBe(true);
    expect(settingsBody.safeParse({ ...base, bandThresholds: { gold: 70, green: 75, amber: 50 } }).success).toBe(false);
    expect(settingsBody.safeParse({ ...base, venue: { ...venue, radiusM: 400 } }).success).toBe(false);
    expect(settingsBody.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(settingsBody.safeParse({ ...base, quietHours: { start: "25:00", end: "06:00" } }).success).toBe(false);
  });
});
