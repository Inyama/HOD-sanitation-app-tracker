import { createEvent, type EventAttributes } from "ics";
import { DateTime } from "luxon";

/** "Add to calendar" (spec 7.2): an .ics file plus Google and Outlook links. Pure functions. */

export interface CalendarMeeting {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  statusNote?: string | null;
}

export interface CalendarContext {
  address: string;
  appUrl: string;
}

const DEFAULT_MINUTES = 120;

function endOf(m: CalendarMeeting): DateTime {
  const start = DateTime.fromISO(m.startsAt, { zone: "utc" });
  return m.endsAt ? DateTime.fromISO(m.endsAt, { zone: "utc" }) : start.plus({ minutes: DEFAULT_MINUTES });
}

function description(m: CalendarMeeting, ctx: CalendarContext): string {
  const lines = [`Household of David Sanitation Unit: ${m.title}.`];
  if (m.status === "CANCELLED") lines.unshift("CANCELLED.");
  if (m.statusNote) lines.push(m.statusNote);
  lines.push(`Check in on the app when you arrive: ${ctx.appUrl}/member/check-in`);
  return lines.join("\n");
}

/** iCalendar text for one meeting (UTC times, stable UID per meeting). */
export function meetingIcs(m: CalendarMeeting, ctx: CalendarContext): string {
  const start = DateTime.fromISO(m.startsAt, { zone: "utc" });
  const end = endOf(m);
  const attrs: EventAttributes = {
    uid: `${m.id}@hod-sanitation-hub`,
    title: m.status === "CANCELLED" ? `CANCELLED: ${m.title}` : m.title,
    description: description(m, ctx),
    location: ctx.address,
    start: [start.year, start.month, start.day, start.hour, start.minute],
    startInputType: "utc",
    startOutputType: "utc",
    end: [end.year, end.month, end.day, end.hour, end.minute],
    endInputType: "utc",
    endOutputType: "utc",
    status: m.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
    url: `${ctx.appUrl}/member/schedule`,
    productId: "hod-sanitation-hub",
    calName: "HOD Sanitation Unit",
    alarms:
      m.status === "CANCELLED"
        ? []
        : [{ action: "display", description: `${m.title} in 1 hour`, trigger: { hours: 1, before: true } }],
  };
  const { error, value } = createEvent(attrs);
  if (error || !value) throw error ?? new Error("Could not build the calendar file");
  return value;
}

const compact = (d: DateTime) => d.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");

export function googleCalendarUrl(m: CalendarMeeting, ctx: CalendarContext): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: m.title,
    dates: `${compact(DateTime.fromISO(m.startsAt, { zone: "utc" }))}/${compact(endOf(m))}`,
    details: description(m, ctx),
    location: ctx.address,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarUrl(m: CalendarMeeting, ctx: CalendarContext): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: m.title,
    startdt: DateTime.fromISO(m.startsAt, { zone: "utc" }).toISO({ suppressMilliseconds: true })!,
    enddt: endOf(m).toISO({ suppressMilliseconds: true })!,
    location: ctx.address,
    body: description(m, ctx),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}
