import Papa from "papaparse";
import { DateTime } from "luxon";
import type { AdminLevel, Role, TitleCode, UserStatus } from "@/lib/repo/types";
import type { BandKey } from "@/lib/attendance/percentage";
import { looksLikeEmail, normalizeEmail, normalizeName } from "@/lib/matching/normalize";

/** Members directory rules (spec 7.4): search, filters, sort, pages, soft delete, CSV import. */

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  adminLevel: AdminLevel | null;
  status: UserStatus;
  isRemote: boolean;
  city: string | null;
  country: string | null;
  teamId: string | null;
  teamName: string | null;
  titles: TitleCode[];
  percent: number | null;
  bandKey: BandKey;
  bandLabel: string;
  createdAt: string;
  approvedAt: string | null;
  lastLoginAt: string | null;
  statusChangedAt: string | null;
  statusReason: string | null;
  emailVerified: boolean;
  deletionRequestedAt: string | null;
}

export type AnyOr<T> = T | "ALL";

export interface MemberFilters {
  q?: string;
  role?: AnyOr<Role>;
  status?: AnyOr<UserStatus>;
  /** A team id, "NONE" for people without a team, or "ALL". */
  teamId?: string;
  band?: AnyOr<BandKey>;
  remote?: "ALL" | "YES" | "NO";
}

/** Search matches name (accents and word order ignored), email or phone digits. */
export function matchesQuery(row: Pick<MemberRow, "name" | "email" | "phone">, q: string): boolean {
  const needle = q.trim();
  if (!needle) return true;
  const n = normalizeName(needle);
  if (n && n.split(" ").every((w) => normalizeName(row.name).includes(w))) return true;
  if (row.email.toLowerCase().includes(needle.toLowerCase())) return true;
  const digits = needle.replace(/\D/g, "");
  return digits.length >= 3 && !!row.phone && row.phone.replace(/\D/g, "").includes(digits);
}

export function filterMembers<T extends MemberRow>(rows: T[], f: MemberFilters): T[] {
  return rows.filter((r) => {
    if (f.q && !matchesQuery(r, f.q)) return false;
    if (f.role && f.role !== "ALL" && r.role !== f.role) return false;
    if (f.status && f.status !== "ALL" && r.status !== f.status) return false;
    if (f.teamId && f.teamId !== "ALL" && (f.teamId === "NONE" ? r.teamId !== null : r.teamId !== f.teamId))
      return false;
    if (f.band && f.band !== "ALL" && r.bandKey !== f.band) return false;
    if (f.remote === "YES" && !r.isRemote) return false;
    if (f.remote === "NO" && r.isRemote) return false;
    return true;
  });
}

export type MemberSort = "name" | "percent" | "createdAt" | "lastLoginAt";

export function sortMembers<T extends MemberRow>(
  rows: T[],
  sort: MemberSort = "name",
  dir: "asc" | "desc" = "asc",
): T[] {
  const sign = dir === "asc" ? 1 : -1;
  const val = (r: T): string | number | null =>
    sort === "percent" ? r.percent : sort === "name" ? r.name.toLowerCase() : r[sort];
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    // Missing values always sink to the bottom.
    if (x === null && y === null) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    if (x < y) return -sign;
    if (x > y) return sign;
    return a.name.localeCompare(b.name);
  });
}

export function paginate<T>(rows: T[], page = 1, pageSize = 25) {
  const size = Math.min(Math.max(1, pageSize), 200);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: rows.slice((p - 1) * size, p * size), total: rows.length, page: p, pageSize: size, pages };
}

// ---------------------------------------------------------------------------
// Soft delete (spec 4.1: Removed is kept for 30 days)
// ---------------------------------------------------------------------------

export const REMOVAL_GRACE_DAYS = 30;

/** When a removed account's personal data is deleted for good; null if not removed. */
export function purgeDate(u: { status: UserStatus; statusChangedAt: string | null }): DateTime | null {
  if (u.status !== "REMOVED" || !u.statusChangedAt) return null;
  return DateTime.fromISO(u.statusChangedAt, { zone: "utc" }).plus({ days: REMOVAL_GRACE_DAYS });
}

/** A removed account can be restored within the 30 days, unless it was a rejected sign-up. */
export function canRestore(
  u: { status: UserStatus; statusChangedAt: string | null; statusReason: string | null },
  now: DateTime,
): boolean {
  const d = purgeDate(u);
  return !!d && now < d && !u.statusReason?.startsWith("Rejected");
}

// ---------------------------------------------------------------------------
// CSV import (spec 7.4: preview and error report)
// ---------------------------------------------------------------------------

export const MAX_IMPORT_ROWS = 500;

export interface ImportRow {
  line: number;
  name: string;
  email: string;
  phone: string | null;
  role: "MEMBER" | "VOLUNTEER";
  teamId: string | null;
  teamName: string | null;
  city: string | null;
  country: string | null;
  isRemote: boolean;
}

export interface ImportProblem {
  line: number;
  field: string;
  message: string;
}

export interface ImportPreview {
  rows: ImportRow[];
  errors: ImportProblem[];
  /** Data rows read (blank lines skipped). */
  total: number;
  fatal: string | null;
}

const HEADER_ALIASES: Record<
  string,
  keyof Omit<ImportRow, "line" | "teamId" | "teamName" | "isRemote"> | "team" | "remote"
> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  email: "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  role: "role",
  team: "team",
  city: "city",
  country: "country",
  remote: "remote",
  "remote member": "remote",
};

const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["no", "n", "false", "0", ""]);

/**
 * Read an import CSV. Columns: name and email (required), phone, role (member or volunteer),
 * team (by name), city, country, remote (yes or no). Every problem names its line so the
 * admin can fix the file; valid rows can still be imported.
 */
export function parseMemberImport(
  text: string,
  ctx: { existingEmails: Set<string>; teams: { id: string; name: string }[] },
): ImportPreview {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const table = parsed.data.filter((r) => r.some((c) => c.trim() !== ""));
  if (table.length === 0) return { rows: [], errors: [], total: 0, fatal: "The file is empty." };
  const header = table[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);
  const col = (k: string) => header.indexOf(k as never);
  if (col("name") < 0 || col("email") < 0)
    return { rows: [], errors: [], total: 0, fatal: "The first row must name the columns, including name and email." };
  const data = table.slice(1);
  if (data.length > MAX_IMPORT_ROWS)
    return { rows: [], errors: [], total: data.length, fatal: `Import up to ${MAX_IMPORT_ROWS} people at a time.` };

  const rows: ImportRow[] = [];
  const errors: ImportProblem[] = [];
  const seen = new Map<string, number>();
  const teamByName = new Map(ctx.teams.map((t) => [t.name.trim().toLowerCase(), t]));

  data.forEach((r, i) => {
    const line = i + 2;
    const get = (k: string) => (col(k) >= 0 ? (r[col(k)] ?? "").trim() : "");
    const problems: ImportProblem[] = [];
    const name = get("name").replace(/\s+/g, " ");
    const email = normalizeEmail(get("email"));
    if (name.length < 2) problems.push({ line, field: "name", message: "Add the person's full name." });
    else if (name.length > 80)
      problems.push({ line, field: "name", message: "The name is longer than 80 characters." });
    if (!email) problems.push({ line, field: "email", message: "Add an email address." });
    else if (!looksLikeEmail(email))
      problems.push({ line, field: "email", message: `"${email}" is not an email address.` });
    else if (ctx.existingEmails.has(email))
      problems.push({ line, field: "email", message: `${email} already has an account.` });
    else if (seen.has(email))
      problems.push({ line, field: "email", message: `${email} is also on line ${seen.get(email)}.` });

    const roleRaw = get("role").toLowerCase();
    const role = roleRaw === "" || roleRaw === "member" ? "MEMBER" : roleRaw === "volunteer" ? "VOLUNTEER" : null;
    if (!role)
      problems.push({ line, field: "role", message: `Role must be member or volunteer, not "${get("role")}".` });

    const teamRaw = get("team");
    const team = teamRaw ? teamByName.get(teamRaw.toLowerCase()) : null;
    if (teamRaw && !team) problems.push({ line, field: "team", message: `There is no team called "${teamRaw}".` });

    const remoteRaw = get("remote").toLowerCase();
    if (!YES.has(remoteRaw) && !NO.has(remoteRaw))
      problems.push({ line, field: "remote", message: `Remote must be yes or no, not "${get("remote")}".` });

    const phone = get("phone");
    if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone))
      problems.push({ line, field: "phone", message: `"${phone}" does not look like a phone number.` });

    if (email && looksLikeEmail(email) && !seen.has(email)) seen.set(email, line);
    if (problems.length) {
      errors.push(...problems);
      return;
    }
    rows.push({
      line,
      name,
      email,
      phone: phone || null,
      role: role!,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      city: get("city") || null,
      country: get("country") || null,
      isRemote: YES.has(remoteRaw),
    });
  });
  return { rows, errors, total: data.length, fatal: null };
}
