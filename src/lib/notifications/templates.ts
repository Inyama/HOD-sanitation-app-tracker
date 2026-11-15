import type { NotificationType } from "./schedule";
import { formatForViewer } from "@/lib/time/zone";

/** Message templates with merge fields (spec 8). */

export const MERGE_FIELDS = [
  "first_name",
  "meeting_name",
  "local_start_time",
  "venue_address",
  "checkin_link",
  "percentage",
  "band",
  "next_meeting",
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeValues = Partial<Record<MergeField, string>>;

/** Replace {field} placeholders; unknown fields are left as typed so authors notice them. */
export function fillMergeFields(text: string, values: MergeValues): string {
  return text.replace(/\{([a-z_]+)\}/g, (whole, key: string) => {
    const v = values[key as MergeField];
    return v === undefined ? whole : v;
  });
}

export function firstName(fullName: string): string {
  const parts = fullName.replace(/^(pastor|dr|mr|mrs|ms|rev)\.?\s+/i, "").split(/\s+/);
  return parts[0] ?? fullName;
}

export interface Template {
  subject: string;
  title: string;
  body: string;
}

export const TEMPLATES: Record<NotificationType, Template> = {
  SAT_DAY_BEFORE: {
    subject: "Sanitation Meeting tomorrow at {local_start_time}",
    title: "Meeting tomorrow",
    body: "Hello {first_name}, the Saturday Sanitation Meeting is tomorrow, {local_start_time}, at {venue_address}. Check-in opens one hour before. Your attendance is currently {percentage} percent.",
  },
  SAT_HOUR_BEFORE: {
    subject: "Sanitation Meeting starts at 9:30 am. Check in when you arrive.",
    title: "Check-in is open",
    body: "Hello {first_name}, the Saturday Sanitation Meeting starts in one hour at {venue_address}. Check-in is open now. Please arrive before 9:30 am so you are marked On time. Your attendance is currently {percentage} percent. Household of David Sanitation Unit.",
  },
  SAT_LATE_NOTICE: {
    subject: "The meeting has started",
    title: "Meeting started",
    body: "Hello {first_name}, the Saturday Sanitation Meeting has started. You can still check in at {checkin_link}; it now counts as Late.",
  },
  SAT_WINDOW_CLOSING: {
    subject: "Check-in closes at 11:30 am",
    title: "Check-in closes soon",
    body: "Hello {first_name}, check-in for today's meeting closes at 11:30 am. Check in now at {checkin_link} if you are at the venue.",
  },
  THU_DAY_BEFORE: {
    subject: "Prayer meeting tomorrow at {local_start_time}",
    title: "Prayer meeting tomorrow",
    body: "Hello {first_name}, the Thursday Prayer Meeting is tomorrow, {local_start_time}. Join us in person or online.",
  },
  THU_HOUR_BEFORE: {
    subject: "Prayer starts at {local_start_time}",
    title: "Prayer in one hour",
    body: "Hello {first_name}, the Thursday Prayer Meeting starts in one hour, {local_start_time}.",
  },
  THU_STARTING: {
    subject: "Prayer is starting now",
    title: "Prayer is starting",
    body: "Hello {first_name}, the Thursday Prayer Meeting is starting now.",
  },
  ABSENCE_FOLLOWUP: {
    subject: "We missed you on Saturday",
    title: "We missed you",
    body: "Hello {first_name}, we missed you at the Saturday Sanitation Meeting. We hope all is well. If something kept you away, you can submit an excuse in the app. Your attendance is currently {percentage} percent.",
  },
  WEEKLY_SUMMARY: {
    subject: "Your week in the Sanitation Unit",
    title: "Your weekly summary",
    body: "Hello {first_name}, your attendance is {percentage} percent ({band}). Next up: {next_meeting}.",
  },
  LOW_ATTENDANCE: {
    subject: "We are here for you",
    title: "Let us help",
    body: "Hello {first_name}, your attendance is now {percentage} percent. Every meeting counts and we would love to see you. If anything is making it hard to come, reply and a leader will reach out.",
  },
  EVENT_DAY_BEFORE: {
    subject: "{meeting_name} is tomorrow",
    title: "Event tomorrow",
    body: "Hello {first_name}, {meeting_name} is tomorrow, {local_start_time}, at {venue_address}.",
  },
  EVENT_HOUR_BEFORE: {
    subject: "{meeting_name} starts in one hour",
    title: "Event in one hour",
    body: "Hello {first_name}, {meeting_name} starts in one hour, {local_start_time}.",
  },
};

export interface RenderContext {
  fullName: string;
  timezone: string;
  meetingName?: string;
  startsAt?: string;
  venueAddress?: string;
  checkinLink?: string;
  percentage?: number | null;
  band?: string;
  nextMeeting?: string;
}

/** Merge values for one recipient; times in their zone with Lagos time in brackets. */
export function mergeValues(ctx: RenderContext): MergeValues {
  return {
    first_name: firstName(ctx.fullName),
    meeting_name: ctx.meetingName,
    local_start_time: ctx.startsAt ? formatForViewer(ctx.startsAt, ctx.timezone) : undefined,
    venue_address: ctx.venueAddress,
    checkin_link: ctx.checkinLink,
    percentage: ctx.percentage === null || ctx.percentage === undefined ? "–" : String(ctx.percentage),
    band: ctx.band,
    next_meeting: ctx.nextMeeting,
  };
}

/**
 * Render a notification for one recipient; times in their zone with Lagos time in brackets.
 * `template` replaces the built-in wording (the admin's override from the Automation screen).
 */
export function renderNotification(type: NotificationType, ctx: RenderContext, template?: Template): Template {
  const values: MergeValues = {
    first_name: firstName(ctx.fullName),
    meeting_name: ctx.meetingName,
    local_start_time: ctx.startsAt ? formatForViewer(ctx.startsAt, ctx.timezone) : undefined,
    venue_address: ctx.venueAddress,
    checkin_link: ctx.checkinLink,
    percentage: ctx.percentage === null || ctx.percentage === undefined ? "–" : String(ctx.percentage),
    band: ctx.band,
    next_meeting: ctx.nextMeeting,
  };
  const t = template ?? TEMPLATES[type];
  return {
    subject: fillMergeFields(t.subject, values),
    title: fillMergeFields(t.title, values),
    body: fillMergeFields(t.body, values),
  };
}
