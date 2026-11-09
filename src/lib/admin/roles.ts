import type { AdminLevel, Role, TitleCode, UserStatus } from "@/lib/repo/types";
import { ADMIN_LEVEL_LABELS, TITLE_LABELS } from "@/lib/repo/types";
import { capabilities, type Actor, type Capability } from "@/lib/auth/permissions";

/**
 * Roles and titles (spec 4.1, 7.4 item 12). The confirmation dialog lists in plain words what
 * the person gains or loses, worked out from the permission matrix so it can never drift.
 */

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "checkin.self": "Check in at meetings",
  "attendance.own": "Own attendance, percentage and report",
  "events.view": "Upcoming events and meeting times",
  "notifications.own": "Reminders and announcements",
  "excuse.submit": "Send excuse requests",
  "volunteer.duties": "Duty board",
  "volunteer.hours": "Service hours",
  "volunteer.issues": "Report an issue",
  "marshal.tools": "Marshal tools (live lists, manual check-in)",
  "team.view": "Team view",
  "excuse.review": "Review excuse requests",
  "duties.manage": "Manage the duty roster",
  "issues.manage": "Manage reported issues",
  "hours.verify": "Verify service hours",
  "stats.unit": "Unit-wide statistics",
  "people.view": "See the members directory",
  "uploads.manage": "Upload attendance sheets",
  "attendance.correct": "Correct attendance records",
  "meetings.manage": "Create and change meetings",
  "reports.download": "Download reports",
  "people.manage": "Add, approve, suspend and remove people",
  "messages.send": "Message all or specific people",
  "roles.assign": "Assign roles and titles",
  "roles.assignAdminLevel": "Change admin levels",
  "settings.manage": "Settings, geofence and schedule",
  "automation.manage": "Reminders and automation",
  "audit.view": "Audit log",
};

export const ROLE_LABELS: Record<Role, string> = { MEMBER: "Member", VOLUNTEER: "Volunteer", ADMIN: "Admin" };

export interface Assignment {
  role: Role;
  adminLevel: AdminLevel | null;
  titles: TitleCode[];
}

export interface RoleEffects {
  gains: string[];
  losses: string[];
  titlesAdded: TitleCode[];
  titlesRemoved: TitleCode[];
  summary: string[];
}

const asActor = (a: Assignment): Actor => ({ ...a, status: "ACTIVE" });

/** Titles only make sense for volunteers; anything else drops them. */
export function normalizeAssignment(a: Assignment): Assignment {
  return {
    role: a.role,
    adminLevel: a.role === "ADMIN" ? a.adminLevel : null,
    titles: a.role === "VOLUNTEER" ? [...new Set(a.titles)].sort() : [],
  };
}

export function roleEffects(before: Assignment, after: Assignment): RoleEffects {
  const b = normalizeAssignment(before);
  const a = normalizeAssignment(after);
  const capsBefore = capabilities(asActor(b));
  const capsAfter = capabilities(asActor(a));
  const gains = [...capsAfter].filter((c) => !capsBefore.has(c)).map((c) => CAPABILITY_LABELS[c]);
  const losses = [...capsBefore].filter((c) => !capsAfter.has(c)).map((c) => CAPABILITY_LABELS[c]);
  const titlesAdded = a.titles.filter((t) => !b.titles.includes(t));
  const titlesRemoved = b.titles.filter((t) => !a.titles.includes(t));
  const summary: string[] = [];
  const describe = (x: Assignment) =>
    x.role === "ADMIN" && x.adminLevel ? ADMIN_LEVEL_LABELS[x.adminLevel] : ROLE_LABELS[x.role];
  if (describe(b) !== describe(a)) summary.push(`${describe(b)} becomes ${describe(a)}.`);
  if (b.role !== a.role) {
    const area = (r: Role) => (r === "ADMIN" ? "Admin" : r === "VOLUNTEER" ? "Volunteer" : "Member");
    summary.push(`They will sign in to the ${area(a.role)} area.`);
  }
  if (titlesAdded.length) summary.push(`New titles: ${titlesAdded.map((t) => TITLE_LABELS[t]).join(", ")}.`);
  if (titlesRemoved.length) summary.push(`Titles removed: ${titlesRemoved.map((t) => TITLE_LABELS[t]).join(", ")}.`);
  return { gains, losses, titlesAdded, titlesRemoved, summary };
}

export type RoleChangeError =
  "NO_CHANGE" | "SELF" | "NOT_ACTIVE" | "NEEDS_SUPER" | "LAST_SUPER" | "ADMIN_BY_INVITE" | "LEVEL_REQUIRED";

export const ROLE_CHANGE_MESSAGES: Record<RoleChangeError, string> = {
  NO_CHANGE: "Nothing has changed.",
  SELF: "You cannot change your own role. Ask another admin.",
  NOT_ACTIVE: "Approve or restore this person before changing their role.",
  NEEDS_SUPER: "Only a Super Admin can change admin roles and levels.",
  LAST_SUPER: "The unit needs at least one Super Admin. Make someone else Super Admin first.",
  ADMIN_BY_INVITE: "Admins join by invitation so they can set up two-factor sign-in. Send an admin invitation instead.",
  LEVEL_REQUIRED: "Choose an admin level.",
};

/**
 * Can `editor` make this change? `editorCaps` comes from the permission matrix
 * (roles.assign is checked by the route; admin-level work needs roles.assignAdminLevel).
 */
export function checkRoleChange(
  editor: { id: string; caps: Set<Capability> },
  target: { id: string; status: UserStatus } & Assignment,
  next: Assignment,
  superAdminCount: number,
): RoleChangeError | null {
  const before = normalizeAssignment(target);
  const after = normalizeAssignment(next);
  if (editor.id === target.id) return "SELF";
  if (target.status !== "ACTIVE" && target.status !== "SUSPENDED") return "NOT_ACTIVE";
  if (after.role === "ADMIN" && !after.adminLevel) return "LEVEL_REQUIRED";
  const touchesAdmin = before.role === "ADMIN" || after.role === "ADMIN";
  if (touchesAdmin && !editor.caps.has("roles.assignAdminLevel")) return "NEEDS_SUPER";
  if (before.role !== "ADMIN" && after.role === "ADMIN") return "ADMIN_BY_INVITE";
  if (before.adminLevel === "SUPER" && after.adminLevel !== "SUPER" && superAdminCount <= 1) return "LAST_SUPER";
  const same =
    before.role === after.role &&
    before.adminLevel === after.adminLevel &&
    before.titles.join(",") === after.titles.join(",");
  if (same) return "NO_CHANGE";
  return null;
}
