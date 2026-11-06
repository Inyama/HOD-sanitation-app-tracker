import type { MatchType, UserStatus } from "@/lib/repo/types";
import { normalizeEmail, normalizeName } from "./normalize";
import { similarity, SUGGEST_THRESHOLD } from "./similarity";

/** Sheet matching (spec 6.4). */

export interface SheetRow {
  name: string;
  email: string | null;
  phone?: string | null;
  time?: string | null;
  status?: string | null;
}

export interface MatchPerson {
  id: string;
  name: string;
  email: string;
  secondaryEmail?: string | null;
  status: UserStatus;
}

export type MatchWarning = "PENDING_ACCOUNT" | "SUSPENDED_ACCOUNT";

export interface RowMatch {
  index: number;
  row: SheetRow;
  matchType: MatchType;
  matchedUserId: string | null;
  similarity: number | null;
  warning: MatchWarning | null;
  /** Index of the earlier row this one repeats (Duplicate only). */
  duplicateOf: number | null;
}

export interface MatchSummary {
  total: number;
  matched: number;
  suggested: number;
  notFound: number;
  duplicates: number;
  warnings: number;
  /** Rows needing an admin decision: Suggested, Not found and Duplicate. */
  exceptions: number;
}

export function matchSheet(rows: SheetRow[], people: MatchPerson[]): { rows: RowMatch[]; summary: MatchSummary } {
  const byEmail = new Map<string, MatchPerson>();
  for (const p of people) {
    if (p.status === "REMOVED") continue;
    byEmail.set(normalizeEmail(p.email), p);
    if (p.secondaryEmail) byEmail.set(normalizeEmail(p.secondaryEmail), p);
  }
  const candidates = people.filter((p) => p.status !== "REMOVED");
  const seenEmail = new Map<string, number>();
  const seenName = new Map<string, number>();
  const out: RowMatch[] = [];

  rows.forEach((row, index) => {
    const email = row.email ? normalizeEmail(row.email) : "";
    const nname = normalizeName(row.name ?? "");

    // Rule 4: repeats of an email or normalised name already seen in this file.
    const dupByEmail = email ? seenEmail.get(email) : undefined;
    const dupOf = dupByEmail !== undefined ? dupByEmail : nname ? seenName.get(nname) : undefined;
    if (dupOf !== undefined) {
      out.push({
        index,
        row,
        matchType: "DUPLICATE",
        matchedUserId: out[dupOf]?.matchedUserId ?? null,
        similarity: null,
        warning: null,
        duplicateOf: dupOf,
      });
      return;
    }
    if (email) seenEmail.set(email, index);
    if (nname) seenName.set(nname, index);

    let match: RowMatch;
    const byMail = email ? byEmail.get(email) : undefined;
    if (byMail) {
      // Rule 1: exact email (primary or secondary).
      match = {
        index,
        row,
        matchType: "EMAIL",
        matchedUserId: byMail.id,
        similarity: 1,
        warning: null,
        duplicateOf: null,
      };
    } else {
      // Rule 2: best name similarity >= 0.90 is Suggested; Rule 3: otherwise Not found.
      let best: MatchPerson | null = null;
      let bestScore = 0;
      for (const p of candidates) {
        const s = similarity(row.name ?? "", p.name);
        if (s > bestScore) {
          bestScore = s;
          best = p;
        }
      }
      match =
        best && bestScore >= SUGGEST_THRESHOLD
          ? {
              index,
              row,
              matchType: "NAME_SUGGESTED",
              matchedUserId: best.id,
              similarity: round3(bestScore),
              warning: null,
              duplicateOf: null,
            }
          : {
              index,
              row,
              matchType: "NOT_FOUND",
              matchedUserId: null,
              similarity: best ? round3(bestScore) : null,
              warning: null,
              duplicateOf: null,
            };
    }

    // Rule 5: flag Pending or Suspended people.
    const person = match.matchedUserId ? people.find((p) => p.id === match.matchedUserId) : undefined;
    if (person?.status === "PENDING") match.warning = "PENDING_ACCOUNT";
    if (person?.status === "SUSPENDED") match.warning = "SUSPENDED_ACCOUNT";
    out.push(match);
  });

  const count = (t: MatchType) => out.filter((r) => r.matchType === t).length;
  const summary: MatchSummary = {
    total: out.length,
    matched: count("EMAIL"),
    suggested: count("NAME_SUGGESTED"),
    notFound: count("NOT_FOUND"),
    duplicates: count("DUPLICATE"),
    warnings: out.filter((r) => r.warning).length,
    exceptions: count("NAME_SUGGESTED") + count("NOT_FOUND") + count("DUPLICATE"),
  };
  return { rows: out, summary };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
