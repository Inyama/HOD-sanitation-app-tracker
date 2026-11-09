import { DateTime } from "luxon";
import { MEETING_ZONE } from "@/lib/time/zone";

/**
 * Global admin date range (spec 7.4 shell): one picker in the top bar drives the dashboard
 * cards and reports. The choice lives in a cookie so it follows the admin from page to page.
 * Days are Lagos calendar days; `to` never runs past "now".
 */

export const RANGE_COOKIE = "hod_range";

export type RangePreset = "4w" | "12w" | "month" | "lastMonth" | "quarter" | "year";

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: "4w", label: "Last 4 weeks" },
  { key: "12w", label: "Last 12 weeks" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
];

export const DEFAULT_RANGE: RangePreset = "12w";

/** Longest custom range, so a typo cannot ask for decades of data. */
export const MAX_RANGE_DAYS = 366 * 2;

export interface DateRange {
  /** Preset key, or "custom". */
  key: RangePreset | "custom";
  /** Cookie value that reproduces this range. */
  value: string;
  label: string;
  from: DateTime;
  to: DateTime;
  /** The period this one is compared with ("change versus previous period"). */
  prevFrom: DateTime;
  prevTo: DateTime;
  /** Lagos dates (yyyy-MM-dd), handy for date inputs and query strings. */
  fromDate: string;
  toDate: string;
}

const CUSTOM_RE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export function encodeCustomRange(fromDate: string, toDate: string): string {
  return `${fromDate}..${toDate}`;
}

function shortDay(d: DateTime, withYear: boolean): string {
  return d.toFormat(withYear ? "d LLL yyyy" : "d LLL");
}

function build(
  key: DateRange["key"],
  value: string,
  label: string,
  from: DateTime,
  to: DateTime,
  prevFrom: DateTime,
  prevTo: DateTime,
): DateRange {
  return {
    key,
    value,
    label,
    from: from.toUTC(),
    to: to.toUTC(),
    prevFrom: prevFrom.toUTC(),
    prevTo: prevTo.toUTC(),
    fromDate: from.setZone(MEETING_ZONE).toISODate()!,
    toDate: to.setZone(MEETING_ZONE).toISODate()!,
  };
}

/** Same length, immediately before. */
function rolling(from: DateTime, to: DateTime) {
  const ms = to.toMillis() - from.toMillis();
  const prevTo = from.minus({ milliseconds: 1 });
  return { prevFrom: prevTo.minus({ milliseconds: ms }), prevTo };
}

/** Parse a custom "yyyy-MM-dd..yyyy-MM-dd" value; null when it is not a sensible range. */
export function parseCustomRange(value: string, now: DateTime): { from: DateTime; to: DateTime } | null {
  const m = CUSTOM_RE.exec(value);
  if (!m) return null;
  const from = DateTime.fromISO(m[1], { zone: MEETING_ZONE }).startOf("day");
  const toDay = DateTime.fromISO(m[2], { zone: MEETING_ZONE }).endOf("day");
  if (!from.isValid || !toDay.isValid || toDay < from) return null;
  if (toDay.diff(from, "days").days > MAX_RANGE_DAYS) return null;
  const nowLagos = now.setZone(MEETING_ZONE);
  if (from > nowLagos) return null;
  return { from, to: toDay > nowLagos ? nowLagos : toDay };
}

/** Turn the cookie value into concrete dates. Unknown values fall back to the default. */
export function resolveRange(value: string | null | undefined, now: DateTime): DateRange {
  const n = now.setZone(MEETING_ZONE);
  const today = n.startOf("day");
  const v = value ?? DEFAULT_RANGE;

  if (CUSTOM_RE.test(v)) {
    const c = parseCustomRange(v, now);
    if (c) {
      const sameYear = c.from.year === c.to.year;
      const label = `${shortDay(c.from, !sameYear)} to ${shortDay(c.to, true)}`;
      const p = rolling(c.from, c.to);
      return build("custom", v, label, c.from, c.to, p.prevFrom, p.prevTo);
    }
  }

  switch (v as RangePreset) {
    case "4w":
    case "12w": {
      const weeks = v === "4w" ? 4 : 12;
      const from = today.minus({ days: weeks * 7 - 1 });
      const p = rolling(from, n);
      return build(v as RangePreset, v, `Last ${weeks} weeks`, from, n, p.prevFrom, p.prevTo);
    }
    case "month": {
      const from = n.startOf("month");
      const prevFrom = from.minus({ months: 1 });
      return build("month", v, "This month", from, n, prevFrom, from.minus({ milliseconds: 1 }));
    }
    case "lastMonth": {
      const from = n.startOf("month").minus({ months: 1 });
      const to = n.startOf("month").minus({ milliseconds: 1 });
      const prevFrom = from.minus({ months: 1 });
      return build(
        "lastMonth",
        v,
        `Last month (${from.toFormat("LLLL")})`,
        from,
        to,
        prevFrom,
        from.minus({ milliseconds: 1 }),
      );
    }
    case "quarter": {
      const from = n.startOf("quarter");
      const prevFrom = from.minus({ quarters: 1 });
      return build("quarter", v, `This quarter (Q${from.quarter})`, from, n, prevFrom, from.minus({ milliseconds: 1 }));
    }
    case "year": {
      const from = n.startOf("year");
      const prevFrom = from.minus({ years: 1 });
      return build("year", v, `This year (${from.year})`, from, n, prevFrom, from.minus({ milliseconds: 1 }));
    }
    default:
      return resolveRange(DEFAULT_RANGE, now);
  }
}

/** True when an ISO instant falls inside [from, to]. */
export function inRange(iso: string | null | undefined, from: DateTime, to: DateTime): boolean {
  if (!iso) return false;
  const t = DateTime.fromISO(iso, { zone: "utc" });
  return t >= from && t <= to;
}
