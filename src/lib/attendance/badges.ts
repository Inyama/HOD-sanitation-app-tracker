import { DateTime } from "luxon";
import type { BadgeCode } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import { attendancePercent } from "./percentage";
import { tally, type CountedMeeting } from "./aggregate";

/**
 * Badges (spec 6.5). Interpretation details are in docs/DECISIONS.md:
 * - Perfect Month: a completed calendar month (Lagos) with at least 4 counted meetings, all attended.
 * - On-time x10: ten consecutive On time meetings (excused meetings are skipped, anything else breaks the run).
 * - Faithful Servant: a completed calendar quarter with at least 8 counted meetings at 90 percent or above.
 * - Comeback: the last 3 months are at least 15 points above the 3 months before (6+ meetings in each).
 * - Service Star: 20 or more verified volunteer hours in one calendar month.
 */

export const BADGE_DEFS: Record<BadgeCode, { name: string; rule: string }> = {
  PERFECT_MONTH: { name: "Perfect Month", rule: "Every meeting attended in a calendar month" },
  ON_TIME_10: { name: "On-time x10", rule: "Ten consecutive On time check-ins" },
  FAITHFUL_SERVANT: { name: "Faithful Servant", rule: "90 percent or above for a quarter" },
  COMEBACK: { name: "Comeback", rule: "Percentage up 15 points in 3 months" },
  SERVICE_STAR: { name: "Service Star", rule: "20 volunteer hours in a month" },
};

export interface EarnedBadge {
  code: BadgeCode;
  earnedAt: string;
}

export interface BadgeInput {
  counted: CountedMeeting[];
  hours?: { hours: number; createdAt: string; verified: boolean }[];
  now: DateTime;
  lateWeight?: number;
}

const lagos = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }).setZone(MEETING_ZONE);

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}

export function computeBadges({ counted, hours = [], now, lateWeight = 1 }: BadgeInput): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  const nowL = now.setZone(MEETING_ZONE);
  const attended = (s: string) => s === "ON_TIME" || s === "LATE";

  // Perfect Month
  const byMonth = groupBy(counted, (c) => lagos(c.meeting.startsAt).toFormat("yyyy-LL"));
  const perfect = [...byMonth.entries()]
    .filter(([key, list]) => {
      const end = DateTime.fromFormat(key, "yyyy-LL", { zone: MEETING_ZONE }).endOf("month");
      return end < nowL && list.length >= 4 && list.every((c) => attended(c.status));
    })
    .map(([key]) => key)
    .sort();
  if (perfect.length) {
    out.push({
      code: "PERFECT_MONTH",
      earnedAt: DateTime.fromFormat(perfect[0], "yyyy-LL", { zone: MEETING_ZONE }).endOf("month").toUTC().toISO()!,
    });
  }

  // On-time x10
  let run = 0;
  for (const c of counted) {
    if (c.status === "EXCUSED") continue;
    run = c.status === "ON_TIME" ? run + 1 : 0;
    if (run === 10) {
      out.push({ code: "ON_TIME_10", earnedAt: c.meeting.startsAt });
      break;
    }
  }

  // Faithful Servant
  const byQuarter = groupBy(counted, (c) => {
    const d = lagos(c.meeting.startsAt);
    return `${d.year}-Q${d.quarter}`;
  });
  for (const [key, list] of [...byQuarter.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [y, q] = key.split("-Q").map(Number);
    const end = DateTime.fromObject({ year: y, month: q * 3, day: 1 }, { zone: MEETING_ZONE }).endOf("month");
    if (end >= nowL || list.length < 8) continue;
    const pct = attendancePercent(tally(list.map((c) => c.status)), lateWeight);
    if (pct !== null && pct >= 90) {
      out.push({ code: "FAITHFUL_SERVANT", earnedAt: end.toUTC().toISO()! });
      break;
    }
  }

  // Comeback
  const recentFrom = now.minus({ months: 3 });
  const priorFrom = now.minus({ months: 6 });
  const inRange = (c: CountedMeeting, from: DateTime, to: DateTime) => {
    const d = DateTime.fromISO(c.meeting.startsAt, { zone: "utc" });
    return d >= from && d < to;
  };
  const recent = counted.filter((c) => inRange(c, recentFrom, now.plus({ seconds: 1 })));
  const prior = counted.filter((c) => inRange(c, priorFrom, recentFrom));
  if (recent.length >= 6 && prior.length >= 6) {
    const a = attendancePercent(tally(recent.map((c) => c.status)), lateWeight);
    const b = attendancePercent(tally(prior.map((c) => c.status)), lateWeight);
    if (a !== null && b !== null && a - b >= 15) out.push({ code: "COMEBACK", earnedAt: now.toUTC().toISO()! });
  }

  // Service Star
  const verified = hours.filter((h) => h.verified);
  const hoursByMonth = groupBy(verified, (h) => lagos(h.createdAt).toFormat("yyyy-LL"));
  const starMonths = [...hoursByMonth.entries()]
    .filter(([, list]) => list.reduce((s, h) => s + h.hours, 0) >= 20)
    .map(([k]) => k)
    .sort();
  if (starMonths.length) {
    const list = hoursByMonth.get(starMonths[0])!;
    out.push({
      code: "SERVICE_STAR",
      earnedAt: list
        .map((h) => h.createdAt)
        .sort()
        .at(-1)!,
    });
  }

  return out;
}
