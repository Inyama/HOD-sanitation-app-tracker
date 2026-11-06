import { DateTime } from "luxon";

/** Every rule runs in the meeting time zone (spec section 0). */
export const MEETING_ZONE = "Africa/Lagos";

export type DateInput = DateTime | Date | string | number;

/** Normalise any input to a UTC Luxon DateTime. ISO strings without an offset are read as UTC. */
export function toUtc(input: DateInput): DateTime {
  if (DateTime.isDateTime(input)) return input.toUTC();
  if (input instanceof Date) return DateTime.fromJSDate(input, { zone: "utc" });
  if (typeof input === "number") return DateTime.fromMillis(input, { zone: "utc" });
  return DateTime.fromISO(input, { zone: "utc" });
}

export function inLagos(input: DateInput): DateTime {
  return toUtc(input).setZone(MEETING_ZONE);
}

/** Build a UTC instant from a Lagos wall-clock time. */
export function lagosTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): DateTime {
  return DateTime.fromObject({ year, month, day, hour, minute, second }, { zone: MEETING_ZONE }).toUTC();
}

/** Parse an ISO string as Lagos wall-clock time when it has no offset. */
export function parseLagos(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: MEETING_ZONE, setZone: false }).toUTC();
}

/** "Sat 7 Nov, 9:30 am" */
export function formatShort(input: DateInput, zone: string = MEETING_ZONE): string {
  const d = toUtc(input).setZone(zone);
  return `${d.toFormat("ccc d LLL")}, ${formatClock(d)}`;
}

/** "9:30 am" (lower-case meridiem, no leading zero) */
export function formatClock(input: DateInput, zone?: string): string {
  const d = zone ? toUtc(input).setZone(zone) : DateTime.isDateTime(input) ? input : toUtc(input).setZone(MEETING_ZONE);
  return d.toFormat("h:mm a").replace("AM", "am").replace("PM", "pm");
}

/** "Saturday 7 November 2026" */
export function formatLongDate(input: DateInput, zone: string = MEETING_ZONE): string {
  return toUtc(input).setZone(zone).toFormat("cccc d LLLL yyyy");
}

/**
 * Time in the viewer's zone with Lagos time in brackets when the zones differ (spec section 8).
 * "Sat 7 Nov, 8:30 am (9:30 am Lagos)"
 */
export function formatForViewer(input: DateInput, viewerZone: string): string {
  const local = formatShort(input, viewerZone);
  const viewerOffset = toUtc(input).setZone(viewerZone).offset;
  const lagosOffset = toUtc(input).setZone(MEETING_ZONE).offset;
  if (viewerOffset === lagosOffset) return local;
  return `${local} (${formatClock(input, MEETING_ZONE)} Lagos)`;
}

export function startOfLagosDay(input: DateInput): DateTime {
  return inLagos(input).startOf("day").toUTC();
}

export function isValidZone(zone: string): boolean {
  return DateTime.fromMillis(0, { zone: "utc" }).setZone(zone).isValid;
}
