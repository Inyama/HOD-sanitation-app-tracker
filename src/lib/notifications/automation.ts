import { DateTime } from "luxon";
import type { AppSettings, AutomationRule, AutomationSettings, Channel } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import {
  NOTIFICATION_TYPES,
  reminderPlan,
  type NotificationType,
  type RuleLookup,
  type SchedMeeting,
} from "./schedule";
import { TEMPLATES, type Template } from "./templates";

/**
 * Reminders and automation (spec 7.4 item 11, spec 8): what each automated notification is,
 * the admin's switches and template overrides, and the coming schedule. Pure.
 */

export const AUTOMATION_ORDER: NotificationType[] = [
  "SAT_DAY_BEFORE",
  "SAT_HOUR_BEFORE",
  "SAT_LATE_NOTICE",
  "SAT_WINDOW_CLOSING",
  "THU_DAY_BEFORE",
  "THU_HOUR_BEFORE",
  "THU_STARTING",
  "EVENT_DAY_BEFORE",
  "EVENT_HOUR_BEFORE",
  "ABSENCE_FOLLOWUP",
  "WEEKLY_SUMMARY",
  "LOW_ATTENDANCE",
];

export const AUTOMATION_META: Record<NotificationType, { label: string; when: string; audience: string }> = {
  SAT_DAY_BEFORE: {
    label: "Saturday: the day before",
    when: "Friday 9:30 am (24 hours before)",
    audience: "Active members and volunteers",
  },
  SAT_HOUR_BEFORE: {
    label: "Saturday: check-in is open",
    when: "Saturday 8:30 am (1 hour before)",
    audience: "Active, not yet checked in",
  },
  SAT_LATE_NOTICE: {
    label: "Saturday: meeting started",
    when: "Saturday 9:30 am (at the start)",
    audience: "Not yet checked in",
  },
  SAT_WINDOW_CLOSING: {
    label: "Saturday: check-in closing",
    when: "Saturday 11:15 am (15 minutes before it closes)",
    audience: "Not yet checked in",
  },
  THU_DAY_BEFORE: {
    label: "Thursday prayer: the day before",
    when: "Wednesday 8:30 pm (24 hours before)",
    audience: "Active",
  },
  THU_HOUR_BEFORE: { label: "Thursday prayer: one hour before", when: "Thursday 7:30 pm", audience: "Active" },
  THU_STARTING: { label: "Thursday prayer: starting now", when: "Thursday 8:30 pm", audience: "Active" },
  EVENT_DAY_BEFORE: { label: "Special event: the day before", when: "24 hours before", audience: "Invited people" },
  EVENT_HOUR_BEFORE: { label: "Special event: one hour before", when: "1 hour before", audience: "Invited people" },
  ABSENCE_FOLLOWUP: {
    label: "Absence follow-up",
    when: "Sunday 9:00 am after a Saturday",
    audience: "Absent and not excused",
  },
  WEEKLY_SUMMARY: { label: "Weekly summary", when: "Sunday 6:00 pm", audience: "Active people who want it" },
  LOW_ATTENDANCE: {
    label: "Low attendance",
    when: "When a meeting takes someone below the threshold",
    audience: "That person, plus a flag for admins",
  },
};

export const DEFAULT_ESCALATION: AutomationSettings["escalation"] = { enabled: true, absences: 2 };

export function defaultRule(type: NotificationType): AutomationRule {
  const ch = NOTIFICATION_TYPES[type].channels;
  return {
    enabled: true,
    email: ch.includes("EMAIL"),
    push: ch.includes("PUSH"),
    subject: null,
    title: null,
    body: null,
  };
}

/** The settings with every type filled in (missing means the defaults). */
export function automationConfig(settings: Pick<AppSettings, "automation">): {
  rules: Record<NotificationType, AutomationRule>;
  escalation: AutomationSettings["escalation"];
} {
  const saved = settings.automation;
  const rules = Object.fromEntries(
    AUTOMATION_ORDER.map((t) => [t, { ...defaultRule(t), ...(saved?.rules?.[t] ?? {}) }]),
  ) as Record<NotificationType, AutomationRule>;
  return { rules, escalation: { ...DEFAULT_ESCALATION, ...(saved?.escalation ?? {}) } };
}

export function ruleLookup(settings: Pick<AppSettings, "automation">): RuleLookup {
  const { rules } = automationConfig(settings);
  return (t) => rules[t];
}

/** The wording to use: the admin's override where set, otherwise the built-in template. */
export function effectiveTemplate(
  type: NotificationType,
  rule: Pick<AutomationRule, "subject" | "title" | "body"> | undefined,
): Template {
  const t = TEMPLATES[type];
  return { subject: rule?.subject || t.subject, title: rule?.title || t.title, body: rule?.body || t.body };
}

/** Channels a rule can use, for the table: in-app always, email and push when the type has them. */
export function ruleChannels(type: NotificationType, rule: AutomationRule): Channel[] {
  const spec = NOTIFICATION_TYPES[type].channels;
  return spec.filter((c) => c === "IN_APP" || (c === "EMAIL" && rule.email) || (c === "PUSH" && rule.push));
}

export interface ScheduledItem {
  type: NotificationType;
  label: string;
  at: string;
  meetingId: string;
  meetingTitle: string;
  enabled: boolean;
}

/** Reminder times for the coming meetings (derived from each start, so moving a meeting moves them). */
export function upcomingSchedule(
  meetings: (SchedMeeting & { title: string })[],
  now: DateTime,
  days: number,
  lookup: RuleLookup,
): ScheduledItem[] {
  const until = now.plus({ days });
  return meetings
    .flatMap((m) =>
      reminderPlan(m).map((p) => ({
        type: p.type,
        label: AUTOMATION_META[p.type].label,
        at: p.at.toISO()!,
        meetingId: m.id,
        meetingTitle: m.title,
        enabled: lookup(p.type)?.enabled ?? true,
      })),
    )
    .filter((i) => {
      const at = DateTime.fromISO(i.at, { zone: "utc" });
      return at > now && at <= until;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** "Fri 13 Nov, 9:30 am" in Lagos time. */
export function scheduleLabel(iso: string): string {
  const d = DateTime.fromISO(iso, { zone: "utc" }).setZone(MEETING_ZONE);
  return `${d.toFormat("ccc d LLL")}, ${d.toFormat("h:mm a").toLowerCase()}`;
}

/** How far back a scheduler run looks when it has not run for a while (catch-up limit). */
export const SCHEDULER_LOOKBACK_MIN = 15;

/**
 * The time window a scheduler run covers: since the last run, but never more than the
 * look-back limit, and only the current minute after a restart or when the clock moved back
 * (demo "Simulate time"). Each reminder still goes out once, because of the dedupe keys.
 */
export function schedulerWindow(
  lastRunIso: string | null,
  now: DateTime,
  lookbackMin = SCHEDULER_LOOKBACK_MIN,
): { from: DateTime; to: DateTime } {
  const oneMinute = now.minus({ minutes: 1 });
  if (!lastRunIso) return { from: oneMinute, to: now };
  const last = DateTime.fromISO(lastRunIso, { zone: "utc" });
  if (!last.isValid || last > now) return { from: oneMinute, to: now };
  const floor = now.minus({ minutes: lookbackMin });
  return { from: last < floor ? floor : last, to: now };
}

/** Exponential back-off for failed emails: 1, 2, 4, 8 minutes; give up after 5 attempts. */
export const MAX_ATTEMPTS = 5;
export function nextRetry(attempts: number, at: DateTime): DateTime | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return at.plus({ minutes: 2 ** (attempts - 1) });
}
