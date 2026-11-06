import { describe, expect, it } from "vitest";
import { canAccessPath, capabilities, WRITE_CAPABILITIES, type Actor, type Capability } from "@/lib/auth/permissions";

const member: Actor = { role: "MEMBER", adminLevel: null, status: "ACTIVE", titles: [] };
const volunteer: Actor = { role: "VOLUNTEER", adminLevel: null, status: "ACTIVE", titles: [] };
const marshal: Actor = { ...volunteer, titles: ["MARSHAL"] };
const teamLead: Actor = { ...volunteer, titles: ["TEAM_LEAD"] };
const admin = (level: Actor["adminLevel"]): Actor => ({
  role: "ADMIN",
  adminLevel: level,
  status: "ACTIVE",
  titles: [],
});

const actors: Record<string, Actor> = {
  member,
  volunteer,
  marshal,
  teamLead,
  super: admin("SUPER"),
  unit: admin("UNIT"),
  attendance: admin("ATTENDANCE_OFFICER"),
  comms: admin("COMMS_OFFICER"),
  auditor: admin("AUDITOR"),
};

/** Spec 4.2 as a table: capability -> who holds it. */
const MATRIX: [Capability, string[]][] = [
  ["checkin.self", Object.keys(actors)],
  ["attendance.own", Object.keys(actors)],
  ["events.view", Object.keys(actors)],
  ["notifications.own", Object.keys(actors)],
  ["excuse.submit", Object.keys(actors)],
  ["excuse.review", ["super", "unit", "attendance"]],
  ["volunteer.duties", ["volunteer", "marshal", "teamLead"]],
  ["volunteer.hours", ["volunteer", "marshal", "teamLead"]],
  ["volunteer.issues", ["volunteer", "marshal", "teamLead"]],
  ["duties.manage", ["super", "unit"]],
  ["issues.manage", ["super", "unit"]],
  ["marshal.tools", ["marshal", "super", "unit", "attendance"]],
  ["team.view", ["teamLead", "super", "unit", "attendance", "comms", "auditor"]],
  ["stats.unit", ["super", "unit", "attendance", "comms", "auditor"]],
  ["uploads.manage", ["super", "unit", "attendance"]],
  ["reports.download", ["super", "unit", "attendance", "auditor"]],
  ["people.manage", ["super", "unit"]],
  ["messages.send", ["super", "unit", "comms"]],
  ["roles.assign", ["super", "unit"]],
  ["roles.assignAdminLevel", ["super"]],
  ["settings.manage", ["super"]],
  ["audit.view", ["super", "unit", "auditor"]],
];

describe("permission matrix (spec 4.2)", () => {
  it.each(MATRIX)("%s is held by exactly the right people", (cap, holders) => {
    const actual = Object.entries(actors)
      .filter(([, a]) => capabilities(a).has(cap))
      .map(([k]) => k);
    expect(actual.sort()).toEqual([...holders].sort());
  });

  it("gives Pending, Suspended and Removed accounts nothing", () => {
    for (const status of ["PENDING", "SUSPENDED", "REMOVED"] as const) {
      expect(capabilities({ ...admin("SUPER"), status }).size).toBe(0);
    }
  });

  it("the Auditor cannot change anything", () => {
    const caps = capabilities(actors.auditor);
    expect(WRITE_CAPABILITIES.filter((c) => caps.has(c))).toEqual([]);
  });
});

describe("route guards", () => {
  it.each([
    ["member", "/member", true],
    ["member", "/member/check-in", true],
    ["member", "/admin", false],
    ["member", "/admin/members", false],
    ["member", "/volunteer", false],
    ["volunteer", "/volunteer", true],
    ["volunteer", "/volunteer/duties", true],
    ["volunteer", "/volunteer/marshal", false],
    ["volunteer", "/volunteer/team", false],
    ["volunteer", "/member/attendance", true],
    ["marshal", "/volunteer/marshal", true],
    ["teamLead", "/volunteer/team", true],
    ["comms", "/admin", true],
    ["comms", "/admin/messages", true],
    ["comms", "/admin/settings", false],
    ["comms", "/admin/uploads", false],
    ["attendance", "/admin/uploads", true],
    ["attendance", "/admin/reports", true],
    ["attendance", "/admin/messages", false],
    ["auditor", "/admin/audit", true],
    ["auditor", "/admin/settings", false],
    ["auditor", "/admin/approvals", false],
    ["super", "/admin/settings", true],
    ["super", "/volunteer", false],
  ])("%s opening %s: %s", (who, path, allowed) => {
    expect(canAccessPath(actors[who], path)).toBe(allowed);
  });

  it("allows public pages for everyone and blocks protected pages when signed out", () => {
    expect(canAccessPath(null, "/")).toBe(true);
    expect(canAccessPath(null, "/login")).toBe(true);
    expect(canAccessPath(null, "/member")).toBe(false);
    expect(canAccessPath({ ...member, status: "SUSPENDED" }, "/member")).toBe(false);
  });
});
