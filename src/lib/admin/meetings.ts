import { DateTime } from "luxon";
import type { AppSettings, Meeting, MeetingType, TrackingMethod } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import { meetingId, rruleFor, SATURDAY_RULE, THURSDAY_RULE } from "@/lib/time/schedule";

/** Meetings and events (spec 5, 7.4 item 7): form defaults, creation, reschedule and cancel rules, calendar. */

export const MAX_REPEAT_WEEKS = 12;

export interface MeetingDefaults {
  title: string;
  time: string;
  durationMin: number;
  method: TrackingMethod;
  openBeforeMin: number;
  closeAfterMin: number;
  graceMinutes: number;
}

export function meetingDefaults(
  type: MeetingType,
  settings: Pick<AppSettings, "graceMinutes" | "openBeforeMinutes" | "closeAfterMinutes">,
): MeetingDefaults {
  if (type === "SATURDAY")
    return {
      title: SATURDAY_RULE.title,
      time: "09:30",
      durationMin: 120,
      method: "GEO",
      openBeforeMin: settings.openBeforeMinutes,
      closeAfterMin: settings.closeAfterMinutes,
      graceMinutes: settings.graceMinutes,
    };
  if (type === "THURSDAY_PRAYER")
    return {
      title: THURSDAY_RULE.title,
      time: "20:30",
      durationMin: 90,
      method: "SHEET",
      openBeforeMin: 0,
      closeAfterMin: 0,
      graceMinutes: settings.graceMinutes,
    };
  return {
    title: "",
    time: "10:00",
    durationMin: 120,
    method: "GEO",
    openBeforeMin: settings.openBeforeMinutes,
    closeAfterMin: settings.closeAfterMinutes,
    graceMinutes: settings.graceMinutes,
  };
}

export interface MeetingForm {
  type: MeetingType;
  title: string;
  /** Lagos date and time. */
  date: string;
  time: string;
  durationMin: number;
  method: TrackingMethod;
  openBeforeMin: number;
  closeAfterMin: number;
  graceMinutes: number;
  radiusM: number | null;
  requireQr: boolean;
  /** 1 = a single meeting; more repeats weekly. */
  repeatWeeks: number;
}

export function lagosStart(date: string, time: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone: MEETING_ZONE });
}

/** Special events get an id from the date and a short random tag so two events can share a day. */
export function specialId(start: DateTime, tag: string): string {
  return `mtg-${start.setZone(MEETING_ZONE).toFormat("yyyy-LL-dd")}-evt-${tag}`;
}

/**
 * Meeting rows for a new meeting (and its weekly repeats). Saturday and Thursday rows use the
 * same ids as the recurring schedule, so a stored row replaces the generated one for that week.
 */
export function buildMeetings(form: MeetingForm, venueId: string | null, tags: string[]): Omit<Meeting, never>[] {
  const weeks = Math.min(Math.max(1, form.repeatWeeks), MAX_REPEAT_WEEKS);
  const first = lagosStart(form.date, form.time);
  const rrule =
    weeks > 1
      ? `FREQ=WEEKLY;COUNT=${weeks};BYDAY=${["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"][first.weekday]};BYHOUR=${first.hour};BYMINUTE=${first.minute};TZID=${MEETING_ZONE}`
      : form.type === "SATURDAY" && form.time === "09:30" && first.weekday === 6
        ? rruleFor(SATURDAY_RULE)
        : form.type === "THURSDAY_PRAYER" && form.time === "20:30" && first.weekday === 4
          ? rruleFor(THURSDAY_RULE)
          : null;
  return Array.from({ length: weeks }, (_, i) => {
    const start = first.plus({ weeks: i });
    return {
      id: form.type === "SPECIAL" ? specialId(start, tags[i] ?? String(i)) : meetingId(form.type, start),
      type: form.type,
      title: form.title.trim(),
      startsAt: start.toUTC().toISO()!,
      endsAt: start.plus({ minutes: form.durationMin }).toUTC().toISO()!,
      venueId,
      method: form.method,
      graceMinutes: form.graceMinutes,
      openBeforeMin: form.method === "SHEET" ? 0 : form.openBeforeMin,
      closeAfterMin: form.method === "SHEET" ? 0 : form.closeAfterMin,
      status: "SCHEDULED" as const,
      recurrenceRule: rrule,
      requireQr: form.method !== "SHEET" && form.requireQr,
      statusNote: null,
      radiusM: form.method === "SHEET" ? null : form.radiusM,
    };
  });
}

export type MeetingChangeError = "IN_PAST" | "ALREADY_HELD" | "CANCELLED" | "SAME_TIME" | "CLASH";

export const MEETING_CHANGE_MESSAGES: Record<MeetingChangeError, string> = {
  IN_PAST: "Choose a date and time in the future.",
  ALREADY_HELD: "This meeting has already started, so it cannot be moved or cancelled. Correct its attendance instead.",
  CANCELLED: "This meeting is already cancelled.",
  SAME_TIME: "That is the time it already has.",
  CLASH: "Another meeting of the same kind is already on that day.",
};

/** A meeting can be moved or cancelled only before it starts. */
export function checkChange(
  meeting: Pick<Meeting, "startsAt" | "status">,
  now: DateTime,
  newStart?: DateTime,
  sameDayOthers: Pick<Meeting, "startsAt">[] = [],
): MeetingChangeError | null {
  if (meeting.status === "CANCELLED") return "CANCELLED";
  if (DateTime.fromISO(meeting.startsAt, { zone: "utc" }) <= now) return "ALREADY_HELD";
  if (!newStart) return null;
  if (newStart <= now) return "IN_PAST";
  if (newStart.toUTC().toISO() === DateTime.fromISO(meeting.startsAt, { zone: "utc" }).toISO()) return "SAME_TIME";
  if (sameDayOthers.length) return "CLASH";
  return null;
}

const when = (d: DateTime) =>
  d.setZone(MEETING_ZONE).toFormat("cccc d LLLL 'at' h:mm a").replace("AM", "am").replace("PM", "pm");

/** Text sent to people when a meeting is cancelled or moved (in-app, email). */
export function changeNotice(
  kind: "CANCELLED" | "RESCHEDULED",
  meeting: Pick<Meeting, "title" | "startsAt">,
  reason: string,
  newStart?: DateTime,
): { title: string; body: string; statusNote: string } {
  const old = DateTime.fromISO(meeting.startsAt, { zone: "utc" });
  if (kind === "CANCELLED")
    return {
      title: `Cancelled: ${meeting.title}, ${old.setZone(MEETING_ZONE).toFormat("ccc d LLL")}`,
      body: `The ${meeting.title} on ${when(old)} (Lagos time) is cancelled. ${reason} It does not count towards anyone's attendance.`,
      statusNote: `Cancelled: ${reason}`,
    };
  return {
    title: `Moved: ${meeting.title} is now ${newStart!.setZone(MEETING_ZONE).toFormat("ccc d LLL, h:mm a").replace("AM", "am").replace("PM", "pm")}`,
    body: `The ${meeting.title} has moved from ${when(old)} to ${when(newStart!)} (Lagos time). ${reason} Reminders follow the new time.`,
    statusNote: `Rescheduled from ${old.setZone(MEETING_ZONE).toFormat("ccc d LLL, h:mm a").replace("AM", "am").replace("PM", "pm")}: ${reason}`,
  };
}

export interface CalendarDay {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  meetings: {
    id: string;
    title: string;
    type: MeetingType;
    time: string;
    startsAt: string;
    status: Meeting["status"];
  }[];
}

/** Month grid, Monday first, six rows at most (Lagos dates). */
export function calendarMonth(
  meetings: Pick<Meeting, "id" | "title" | "type" | "startsAt" | "status">[],
  month: string,
  now: DateTime,
): CalendarDay[][] {
  const first = DateTime.fromISO(`${month}-01`, { zone: MEETING_ZONE });
  const start = first.minus({ days: first.weekday - 1 });
  const end = first.endOf("month");
  const today = now.setZone(MEETING_ZONE).toISODate();
  const byDay = new Map<string, CalendarDay["meetings"]>();
  for (const m of meetings) {
    const d = DateTime.fromISO(m.startsAt, { zone: "utc" }).setZone(MEETING_ZONE);
    const key = d.toISODate()!;
    const list = byDay.get(key) ?? [];
    list.push({
      id: m.id,
      title: m.title,
      type: m.type,
      time: d.toFormat("h:mm a").toLowerCase(),
      startsAt: m.startsAt,
      status: m.status,
    });
    byDay.set(key, list);
  }
  const weeks: CalendarDay[][] = [];
  let d = start;
  while (d <= end || weeks.length === 0 || weeks.at(-1)!.length < 7) {
    if (!weeks.length || weeks.at(-1)!.length === 7) {
      if (d > end) break;
      weeks.push([]);
    }
    const key = d.toISODate()!;
    weeks.at(-1)!.push({
      date: key,
      inMonth: d.month === first.month,
      isToday: key === today,
      meetings: (byDay.get(key) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    });
    d = d.plus({ days: 1 });
  }
  return weeks;
}
