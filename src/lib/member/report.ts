import "server-only";
import { z } from "zod";
import type { DateTime } from "luxon";
import type { User } from "@/lib/repo/types";
import { loadMemberData } from "./data";
import { buildMemberReport, resolvePeriod, type PeriodKey } from "@/lib/reports/member-report";

export const reportQuery = z.object({
  period: z
    .enum(["this-month", "last-month", "last-3-months", "year-to-date", "all", "custom"])
    .default("last-3-months"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** One member's statement for the period in the query string, or null when the query is invalid. */
export async function reportFor(user: User, params: URLSearchParams, now: DateTime) {
  const q = reportQuery.safeParse(Object.fromEntries(params));
  if (!q.success) return null;
  const d = await loadMemberData(user, now);
  const period = resolvePeriod(q.data.period as PeriodKey, now, { from: q.data.from, to: q.data.to });
  return buildMemberReport({
    person: user,
    records: d.records,
    meetings: d.meetings,
    period,
    now,
    lateWeight: d.settings.lateWeight,
    thresholds: d.settings.bandThresholds,
  });
}
