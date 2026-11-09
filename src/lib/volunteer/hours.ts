import { DateTime } from "luxon";
import type { ServiceHour } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";

/**
 * Service hours (spec 7.3). Automatic hours come from check-ins and count as verified;
 * manual entries wait for an admin to verify them.
 */

export const AUTO_HOURS_DEFAULT = 2;
export const MANUAL_MIN = 0.5;
export const MANUAL_MAX = 12;

export const isVerified = (h: Pick<ServiceHour, "source" | "verifiedById">) => h.source === "AUTO" || !!h.verifiedById;

/** Hours for an attended meeting: its length when known, otherwise 2. */
export function autoHoursFor(meeting: { startsAt: string; endsAt: string | null }): number {
  if (!meeting.endsAt) return AUTO_HOURS_DEFAULT;
  const h = DateTime.fromISO(meeting.endsAt).diff(DateTime.fromISO(meeting.startsAt), "hours").hours;
  return Math.max(0.5, Math.round(h * 2) / 2);
}

export interface MonthHours {
  month: string;
  label: string;
  verified: number;
  pending: number;
}

/** Verified and pending hours per calendar month (Lagos), oldest first. */
export function hoursByMonth(hours: ServiceHour[], now: DateTime, months = 12): MonthHours[] {
  const start = now
    .setZone(MEETING_ZONE)
    .startOf("month")
    .minus({ months: months - 1 });
  return Array.from({ length: months }, (_, i) => {
    const m = start.plus({ months: i });
    const key = m.toFormat("yyyy-LL");
    const inMonth = hours.filter(
      (h) => DateTime.fromISO(h.createdAt, { zone: "utc" }).setZone(MEETING_ZONE).toFormat("yyyy-LL") === key,
    );
    const sum = (xs: ServiceHour[]) => Math.round(xs.reduce((s, h) => s + h.hours, 0) * 10) / 10;
    return {
      month: key,
      label: m.toFormat("LLL"),
      verified: sum(inMonth.filter(isVerified)),
      pending: sum(inMonth.filter((h) => !isVerified(h))),
    };
  });
}

export interface HoursSummary {
  thisMonth: number;
  thisYear: number;
  allTime: number;
  pending: number;
}

export function summarizeHours(hours: ServiceHour[], now: DateTime): HoursSummary {
  const l = now.setZone(MEETING_ZONE);
  const verified = hours.filter(isVerified);
  const sum = (xs: ServiceHour[]) => Math.round(xs.reduce((s, h) => s + h.hours, 0) * 10) / 10;
  const inZone = (h: ServiceHour) => DateTime.fromISO(h.createdAt, { zone: "utc" }).setZone(MEETING_ZONE);
  return {
    thisMonth: sum(verified.filter((h) => inZone(h).hasSame(l, "month"))),
    thisYear: sum(verified.filter((h) => inZone(h).hasSame(l, "year"))),
    allTime: sum(verified),
    pending: sum(hours.filter((h) => !isVerified(h))),
  };
}

export function verifiedHoursInYear(hours: ServiceHour[], year: number): number {
  return (
    Math.round(
      hours
        .filter(
          (h) => isVerified(h) && DateTime.fromISO(h.createdAt, { zone: "utc" }).setZone(MEETING_ZONE).year === year,
        )
        .reduce((s, h) => s + h.hours, 0) * 10,
    ) / 10
  );
}
