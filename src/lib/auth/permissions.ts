import type { AdminLevel, Role, TitleCode, UserStatus } from "@/lib/repo/types";

/**
 * Permission matrix (spec 4.2). Enforced on the server for every page and API route;
 * hiding a button is never sufficient. Admin-level detail is in docs/DECISIONS.md.
 */

export type Capability =
  // Everyone (own data)
  | "checkin.self"
  | "attendance.own"
  | "events.view"
  | "notifications.own"
  | "excuse.submit"
  // Volunteer
  | "volunteer.duties"
  | "volunteer.hours"
  | "volunteer.issues"
  | "marshal.tools"
  | "team.view"
  // Admin
  | "excuse.review"
  | "duties.manage"
  | "issues.manage"
  | "hours.verify"
  | "stats.unit"
  | "people.view"
  | "uploads.manage"
  | "attendance.correct"
  | "meetings.manage"
  | "reports.download"
  | "people.manage"
  | "messages.send"
  | "roles.assign"
  | "roles.assignAdminLevel"
  | "settings.manage"
  | "automation.manage"
  | "audit.view";

export interface Actor {
  role: Role;
  adminLevel: AdminLevel | null;
  status: UserStatus;
  titles: TitleCode[];
}

const OWN: Capability[] = ["checkin.self", "attendance.own", "events.view", "notifications.own", "excuse.submit"];

const ALL_LEVELS: AdminLevel[] = ["SUPER", "UNIT", "ATTENDANCE_OFFICER", "COMMS_OFFICER", "AUDITOR"];

/** Which admin levels hold each admin capability. */
export const ADMIN_MATRIX: Partial<Record<Capability, AdminLevel[]>> = {
  "stats.unit": ALL_LEVELS,
  "people.view": ALL_LEVELS,
  "team.view": ALL_LEVELS,
  "reports.download": ["SUPER", "UNIT", "ATTENDANCE_OFFICER", "AUDITOR"],
  "uploads.manage": ["SUPER", "UNIT", "ATTENDANCE_OFFICER"],
  "attendance.correct": ["SUPER", "UNIT", "ATTENDANCE_OFFICER"],
  "excuse.review": ["SUPER", "UNIT", "ATTENDANCE_OFFICER"],
  "marshal.tools": ["SUPER", "UNIT", "ATTENDANCE_OFFICER"],
  "meetings.manage": ["SUPER", "UNIT"],
  "duties.manage": ["SUPER", "UNIT"],
  "issues.manage": ["SUPER", "UNIT"],
  "hours.verify": ["SUPER", "UNIT"],
  "people.manage": ["SUPER", "UNIT"],
  "messages.send": ["SUPER", "UNIT", "COMMS_OFFICER"],
  "roles.assign": ["SUPER", "UNIT"],
  "roles.assignAdminLevel": ["SUPER"],
  "settings.manage": ["SUPER"],
  "automation.manage": ["SUPER"],
  "audit.view": ["SUPER", "UNIT", "AUDITOR"],
};

export function capabilities(actor: Actor): Set<Capability> {
  const caps = new Set<Capability>();
  if (actor.status !== "ACTIVE") return caps;
  OWN.forEach((c) => caps.add(c));
  if (actor.role === "VOLUNTEER") {
    caps.add("volunteer.duties");
    caps.add("volunteer.hours");
    caps.add("volunteer.issues");
    if (actor.titles.includes("MARSHAL")) caps.add("marshal.tools");
    if (actor.titles.includes("TEAM_LEAD")) caps.add("team.view");
  }
  if (actor.role === "ADMIN" && actor.adminLevel) {
    for (const [cap, levels] of Object.entries(ADMIN_MATRIX) as [Capability, AdminLevel[]][]) {
      if (levels.includes(actor.adminLevel)) caps.add(cap);
    }
  }
  return caps;
}

export function can(actor: Actor | null | undefined, cap: Capability): boolean {
  return !!actor && capabilities(actor).has(cap);
}

/** Write capabilities: an Auditor must hold none of these. */
export const WRITE_CAPABILITIES: Capability[] = [
  "uploads.manage",
  "attendance.correct",
  "excuse.review",
  "marshal.tools",
  "meetings.manage",
  "duties.manage",
  "issues.manage",
  "hours.verify",
  "people.manage",
  "messages.send",
  "roles.assign",
  "roles.assignAdminLevel",
  "settings.manage",
  "automation.manage",
];

// ---------------------------------------------------------------------------
// Route guards: most specific prefix wins.
// ---------------------------------------------------------------------------

export type RouteRule = { prefix: string; requires: Capability | "role:volunteer" | "role:admin" | "signed-in" };

export const ROUTE_RULES: RouteRule[] = [
  { prefix: "/member", requires: "attendance.own" },
  { prefix: "/volunteer/marshal", requires: "marshal.tools" },
  { prefix: "/volunteer/team", requires: "team.view" },
  { prefix: "/volunteer", requires: "role:volunteer" },
  { prefix: "/admin/live", requires: "stats.unit" },
  { prefix: "/admin/members", requires: "people.view" },
  { prefix: "/admin/approvals", requires: "people.manage" },
  { prefix: "/admin/uploads", requires: "uploads.manage" },
  { prefix: "/admin/meetings", requires: "meetings.manage" },
  { prefix: "/admin/reports", requires: "reports.download" },
  { prefix: "/admin/analytics", requires: "stats.unit" },
  { prefix: "/admin/messages", requires: "messages.send" },
  { prefix: "/admin/automation", requires: "automation.manage" },
  { prefix: "/admin/roles", requires: "roles.assign" },
  { prefix: "/admin/excuses", requires: "excuse.review" },
  { prefix: "/admin/duties", requires: "duties.manage" },
  { prefix: "/admin/corrections", requires: "attendance.correct" },
  { prefix: "/admin/audit", requires: "audit.view" },
  { prefix: "/admin/settings", requires: "settings.manage" },
  { prefix: "/admin", requires: "role:admin" },
];

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function ruleFor(path: string): RouteRule | null {
  return (
    ROUTE_RULES.filter((r) => matches(path, r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null
  );
}

/** Can this person open this page? Public paths (no rule) are always allowed. */
export function canAccessPath(actor: Actor | null | undefined, path: string): boolean {
  const rule = ruleFor(path);
  if (!rule) return true;
  if (!actor || actor.status !== "ACTIVE") return false;
  switch (rule.requires) {
    case "signed-in":
      return true;
    case "role:volunteer":
      return actor.role === "VOLUNTEER";
    case "role:admin":
      return actor.role === "ADMIN" && !!actor.adminLevel;
    default:
      return can(actor, rule.requires);
  }
}
