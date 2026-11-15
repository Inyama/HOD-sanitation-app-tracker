import { DateTime } from "luxon";
import type { AuditLog } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import { toCsv } from "@/lib/reports/csv";

/** Audit log screen (spec 7.4 item 16): who, what, when, from where; filters; export. */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_SIGNED_UP: "Signed up",
  USER_APPROVED: "Approved a person",
  USER_REJECTED: "Declined a sign-up",
  USER_ADDED: "Added a person",
  USER_IMPORTED: "Imported people",
  USER_UPDATED: "Edited a profile",
  USER_SUSPENDED: "Suspended a person",
  USER_REACTIVATED: "Reactivated a person",
  USER_REMOVED: "Removed a person",
  USER_RESTORED: "Restored a person",
  DELETION_CONFIRMED: "Confirmed a deletion request",
  DELETION_DECLINED: "Kept an account after a deletion request",
  TEAM_ASSIGNED: "Changed a team",
  NOTE_ADDED: "Added a profile note",
  ROLE_CHANGED: "Changed a role or titles",
  INVITE_SENT: "Sent an admin invitation",
  INVITE_ACCEPTED: "Accepted an admin invitation",
  PASSWORD_RESET: "Reset a password",
  SETTINGS_UPDATED: "Changed settings",
  VENUE_UPDATED: "Moved the venue pin",
  MEETING_CANCELLED: "Cancelled a meeting",
  MEETING_CREATED: "Created a meeting",
  MEETING_UPDATED: "Edited a meeting",
  MEETING_RESCHEDULED: "Rescheduled a meeting",
  MEETING_CLOSED: "Closed a meeting and recorded absentees",
  FLAG_REVIEWED: "Cleared a flagged check-in",
  DISPUTE_RESOLVED: "Resolved an attendance query",
  DUTY_ASSIGNED: "Put a volunteer on the roster",
  DUTY_MOVED: "Moved a volunteer to another zone",
  DUTY_REMOVED: "Took a volunteer off the roster",
  UPLOAD_ROLLED_BACK: "Rolled back a sheet upload",
  UPLOAD_DISCARDED: "Discarded a sheet preview",
  MESSAGE_SCHEDULED: "Scheduled a message",
  MESSAGE_CANCELLED: "Cancelled a scheduled message",
  ANNOUNCEMENT_UPDATED: "Edited an announcement",
  ANNOUNCEMENT_DELETED: "Deleted an announcement",
  AUTOMATION_UPDATED: "Changed an automated notification",
  AUTOMATION_TEST_SENT: "Sent a test notification",
  EXCUSE_APPROVED: "Approved an excuse",
  EXCUSE_DECLINED: "Declined an excuse",
  MESSAGE_SENT: "Sent a message",
  ANNOUNCEMENT_POSTED: "Posted an announcement",
  ATTENDANCE_CORRECTED: "Corrected attendance",
  MANUAL_CHECK_IN: "Recorded a manual check-in",
  UPLOAD_PREVIEWED: "Previewed a sheet upload",
  UPLOAD_CONFIRMED: "Confirmed a sheet upload",
  DUTIES_PUBLISHED: "Published the duty roster",
  DUTY_SWAP_APPROVED: "Approved a duty swap",
  DUTY_SWAP_DECLINED: "Declined a duty swap",
  REPORT_DOWNLOADED: "Downloaded a report",
  AUDIT_EXPORTED: "Exported the audit log",
  ISSUE_UPDATED: "Updated an issue",
};

export function actionLabel(action: string): string {
  return (
    AUDIT_ACTION_LABELS[action] ??
    action
      .toLowerCase()
      .split("_")
      .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}

export interface AuditFilters {
  q?: string;
  actorId?: string;
  action?: string;
  entity?: string;
  /** Lagos dates, inclusive. */
  from?: string;
  to?: string;
}

export function filterAudit(rows: AuditLog[], f: AuditFilters, names: Map<string, string>): AuditLog[] {
  const from = f.from ? DateTime.fromISO(f.from, { zone: MEETING_ZONE }).startOf("day") : null;
  const to = f.to ? DateTime.fromISO(f.to, { zone: MEETING_ZONE }).endOf("day") : null;
  const q = f.q?.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (f.actorId && r.actorId !== f.actorId) return false;
      if (f.action && r.action !== f.action) return false;
      if (f.entity && r.entity !== f.entity) return false;
      const at = DateTime.fromISO(r.createdAt, { zone: "utc" });
      if (from?.isValid && at < from) return false;
      if (to?.isValid && at > to) return false;
      if (q) {
        const hay = [
          actionLabel(r.action),
          r.action,
          r.entity,
          r.entityId ?? "",
          r.actorId ? (names.get(r.actorId) ?? "") : "System",
          r.entityId ? (names.get(r.entityId) ?? "") : "",
          r.ip ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.length ? v.map(show).join(", ") : "none";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Field-by-field difference for the before and after shown in the audit detail. */
export function describeChange(before: unknown, after: unknown): FieldChange[] {
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const b = obj(before);
  const a = obj(after);
  if (!b && !a) {
    if (before === null && after === null) return [];
    return [{ field: "value", before: show(before), after: show(after) }];
  }
  const keys = [...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])];
  return keys.map((k) => ({ field: k, before: show(b?.[k]), after: show(a?.[k]) })).filter((c) => c.before !== c.after);
}

export function auditCsv(rows: AuditLog[], names: Map<string, string>): string {
  return toCsv(rows, [
    {
      header: "When (Lagos)",
      value: (r) => DateTime.fromISO(r.createdAt).setZone(MEETING_ZONE).toFormat("yyyy-LL-dd HH:mm:ss"),
    },
    { header: "Who", value: (r) => (r.actorId ? (names.get(r.actorId) ?? r.actorId) : "System") },
    { header: "Action", value: (r) => actionLabel(r.action) },
    { header: "Action code", value: (r) => r.action },
    { header: "Entity", value: (r) => r.entity },
    { header: "Entity id", value: (r) => r.entityId },
    { header: "Entity name", value: (r) => (r.entityId ? names.get(r.entityId) : "") },
    { header: "From (IP)", value: (r) => r.ip },
    {
      header: "Changes",
      value: (r) =>
        describeChange(r.before, r.after)
          .map((c) => `${c.field}: ${c.before} -> ${c.after}`)
          .join("; "),
    },
  ]);
}
