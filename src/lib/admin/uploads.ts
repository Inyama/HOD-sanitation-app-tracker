import { DateTime } from "luxon";
import type { Meeting, UploadRow, User } from "@/lib/repo/types";
import type { RowMatch, SheetRow } from "@/lib/matching/matchSheet";
import type { Resolution } from "@/lib/matching/upload";

/**
 * Upload wizard helpers (spec 6.4, 7.4 item 6). Matching itself lives in src/lib/matching;
 * these turn stored preview rows into matches, keep admin decisions and decide when the
 * upload can be confirmed.
 */

/** Who is expected at a meeting: active, approved before it started; remote members skip Saturdays. */
export function expectedPeople(
  meeting: Pick<Meeting, "type" | "startsAt">,
  users: Pick<User, "id" | "status" | "approvedAt" | "isRemote">[],
) {
  const start = DateTime.fromISO(meeting.startsAt, { zone: "utc" });
  return users.filter(
    (u) =>
      u.status === "ACTIVE" &&
      !!u.approvedAt &&
      DateTime.fromISO(u.approvedAt, { zone: "utc" }) <= start &&
      !(u.isRemote && meeting.type === "SATURDAY"),
  );
}

/** Stored text form of a decision on one row. */
export function encodeResolution(r: Resolution): string {
  return r.kind === "ASSIGN" ? `ASSIGN:${r.userId}` : r.kind;
}

export function decodeResolution(s: string | null): Resolution | null {
  if (!s) return null;
  if (s === "ACCEPT" || s === "CONFIRMED") return { kind: "ACCEPT" };
  if (s === "IGNORE") return { kind: "IGNORE" };
  if (s.startsWith("ASSIGN:")) return { kind: "ASSIGN", userId: s.slice(7) };
  return null;
}

/** Rebuild matches from stored rows (in file order), with Pending or Suspended warnings. */
export function matchesFromRows(
  rows: Pick<UploadRow, "rawName" | "rawEmail" | "rawTime" | "matchedUserId" | "matchType" | "similarity">[],
  statusOf: (userId: string) => User["status"] | undefined,
): RowMatch[] {
  const firstByUser = new Map<string, number>();
  return rows.map((r, index) => {
    const row: SheetRow = { name: r.rawName, email: r.rawEmail, time: r.rawTime };
    const status = r.matchedUserId ? statusOf(r.matchedUserId) : undefined;
    let duplicateOf: number | null = null;
    if (r.matchType === "DUPLICATE" && r.matchedUserId) duplicateOf = firstByUser.get(r.matchedUserId) ?? null;
    if (r.matchedUserId && r.matchType !== "DUPLICATE" && !firstByUser.has(r.matchedUserId))
      firstByUser.set(r.matchedUserId, index);
    return {
      index,
      row,
      matchType: r.matchType,
      matchedUserId: r.matchedUserId,
      similarity: r.similarity,
      warning: status === "PENDING" ? "PENDING_ACCOUNT" : status === "SUSPENDED" ? "SUSPENDED_ACCOUNT" : null,
      duplicateOf,
    };
  });
}

/** Suggested rows still waiting for the admin to accept or ignore them. */
export function undecided(matches: RowMatch[], resolutions: Map<number, Resolution>): RowMatch[] {
  return matches.filter((m) => m.matchType === "NAME_SUGGESTED" && !resolutions.has(m.index));
}

export interface ConfirmPlanSummary {
  present: number;
  onTime: number;
  late: number;
  absent: number;
  excused: number;
  ignored: number;
}

export function summarizeDrafts(
  drafts: { status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED" }[],
  ignored: number,
): ConfirmPlanSummary {
  const c = (s: string) => drafts.filter((d) => d.status === s).length;
  return {
    present: c("ON_TIME") + c("LATE"),
    onTime: c("ON_TIME"),
    late: c("LATE"),
    absent: c("ABSENT"),
    excused: c("EXCUSED"),
    ignored,
  };
}

/** Rows the admin chose to skip (or that stay unmatched). */
export function ignoredCount(matches: RowMatch[], resolutions: Map<number, Resolution>): number {
  return matches.filter((m) => {
    if (m.matchType === "DUPLICATE") return false;
    const r = resolutions.get(m.index) ?? (m.matchType === "EMAIL" ? { kind: "ACCEPT" } : { kind: "IGNORE" });
    return r.kind === "IGNORE";
  }).length;
}
