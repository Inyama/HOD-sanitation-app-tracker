import { DateTime } from "luxon";
import type { Meeting, MeetingType, TrackingMethod } from "@/lib/repo/types";
import { MEETING_ZONE } from "./zone";

/** Meeting schedule (spec section 5). All rules run in Africa/Lagos. */

export interface RecurringRule {
  type: MeetingType;
  title: string;
  /** Luxon weekday: 1 = Monday ... 4 = Thursday ... 6 = Saturday. */
  weekday: number;
  hour: number;
  minute: number;
  method: TrackingMethod;
  openBeforeMin: number;
  closeAfterMin: number;
}

export const SATURDAY_RULE: RecurringRule = {
  type: "SATURDAY",
  title: "Saturday Sanitation Meeting",
  weekday: 6,
  hour: 9,
  minute: 30,
  method: "GEO",
  openBeforeMin: 60,
  closeAfterMin: 120,
};

export const THURSDAY_RULE: RecurringRule = {
  type: "THURSDAY_PRAYER",
  title: "Thursday Prayer Meeting",
  weekday: 4,
  hour: 20,
  minute: 30,
  method: "SHEET",
  openBeforeMin: 0,
  closeAfterMin: 0,
};

export function rruleFor(rule: RecurringRule): string {
  const day = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"][rule.weekday];
  return `FREQ=WEEKLY;BYDAY=${day};BYHOUR=${rule.hour};BYMINUTE=${rule.minute};TZID=${MEETING_ZONE}`;
}

/**
 * Every occurrence of a weekly rule with from <= start < to, as UTC instants.
 * Wall-clock times are fixed in Lagos (no daylight saving there).
 */
export function occurrences(rule: RecurringRule, from: DateTime, to: DateTime): DateTime[] {
  const out: DateTime[] = [];
  let d = from.setZone(MEETING_ZONE).startOf("day");
  const shift = (rule.weekday - d.weekday + 7) % 7;
  d = d.plus({ days: shift }).set({ hour: rule.hour, minute: rule.minute, second: 0, millisecond: 0 });
  if (d < from.setZone(MEETING_ZONE)) d = d.plus({ weeks: 1 });
  while (d < to.setZone(MEETING_ZONE)) {
    out.push(d.toUTC());
    d = d.plus({ weeks: 1 });
  }
  return out;
}

/** The last `count` occurrences strictly before `before`, oldest first. */
export function previousOccurrences(rule: RecurringRule, before: DateTime, count: number): DateTime[] {
  return occurrences(rule, before.minus({ weeks: count + 1 }), before).slice(-count);
}

/** The next `count` occurrences at or after `from`. */
export function nextOccurrences(rule: RecurringRule, from: DateTime, count: number): DateTime[] {
  return occurrences(rule, from, from.plus({ weeks: count + 1 })).slice(0, count);
}

export function meetingId(type: MeetingType, start: DateTime): string {
  const tag = type === "SATURDAY" ? "sat" : type === "THURSDAY_PRAYER" ? "thu" : "evt";
  return `mtg-${start.setZone(MEETING_ZONE).toFormat("yyyy-LL-dd")}-${tag}`;
}

export interface UpcomingCandidate {
  id: string;
  startsAt: string;
  status: string;
}

/** Next meeting that has not finished (start + closeAfter not yet passed) and is not cancelled. */
export function nextMeeting<T extends UpcomingCandidate & { closeAfterMin: number }>(
  meetings: T[],
  now: DateTime,
): T | null {
  const upcoming = meetings
    .filter((m) => m.status !== "CANCELLED")
    .filter((m) => DateTime.fromISO(m.startsAt, { zone: "utc" }).plus({ minutes: Math.max(m.closeAfterMin, 0) }) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return upcoming[0] ?? null;
}

/**
 * Recurring meetings (spec 5: "recurring rules generate dated meeting rows").
 * Adds the weekly Saturday and Thursday occurrences for the next `weeks` weeks that are not
 * stored yet, so there is always a next meeting whatever today's date is. A stored row with
 * the same id (including a cancelled or rescheduled one) always wins.
 */
export function withRecurringMeetings(
  stored: Meeting[],
  now: DateTime,
  weeks = 4,
  rules: RecurringRule[] = [SATURDAY_RULE, THURSDAY_RULE],
): Meeting[] {
  const ids = new Set(stored.map((m) => m.id));
  const venueId = stored.find((m) => m.venueId)?.venueId ?? null;
  const generated: Meeting[] = [];
  for (const rule of rules) {
    for (const start of occurrences(rule, now.minus({ days: 1 }), now.plus({ weeks }))) {
      const id = meetingId(rule.type, start);
      if (ids.has(id)) continue;
      generated.push({
        id,
        type: rule.type,
        title: rule.title,
        startsAt: start.toISO()!,
        endsAt: start.plus({ minutes: rule.type === "SATURDAY" ? 120 : 90 }).toISO()!,
        venueId,
        method: rule.method,
        graceMinutes: 0,
        openBeforeMin: rule.openBeforeMin,
        closeAfterMin: rule.closeAfterMin,
        status: "SCHEDULED",
        recurrenceRule: rruleFor(rule),
        requireQr: false,
        statusNote: null,
      });
    }
  }
  return [...stored, ...generated].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
