import { DateTime } from "luxon";
import type { Channel, MeetingStatus, MeetingType, NotifPrefs, Role, UserStatus } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";

/**
 * Notification timing (spec 6.7 and 8). `dueNotifications` is pure: given "now", the meetings,
 * the people and the keys already sent, it returns exactly what to send in the current minute.
 */

export type NotificationType =
  | "SAT_DAY_BEFORE"
  | "SAT_HOUR_BEFORE"
  | "SAT_LATE_NOTICE"
  | "SAT_WINDOW_CLOSING"
  | "THU_DAY_BEFORE"
  | "THU_HOUR_BEFORE"
  | "THU_STARTING"
  | "ABSENCE_FOLLOWUP"
  | "WEEKLY_SUMMARY"
  | "LOW_ATTENDANCE"
  | "EVENT_DAY_BEFORE"
  | "EVENT_HOUR_BEFORE";

export type Audience = "ACTIVE" | "NOT_CHECKED_IN" | "ABSENT_UNEXCUSED" | "INVITED";

interface TypeSpec {
  channels: Channel[];
  /** Optional messages can be turned off and respect quiet hours. */
  optional: boolean;
  /** Saturday-only messages skip Remote members (they are excluded from the geofence requirement). */
  saturday: boolean;
}

export const NOTIFICATION_TYPES: Record<NotificationType, TypeSpec> = {
  SAT_DAY_BEFORE: { channels: ["EMAIL", "IN_APP", "PUSH"], optional: false, saturday: true },
  SAT_HOUR_BEFORE: { channels: ["EMAIL", "IN_APP", "PUSH"], optional: false, saturday: true },
  SAT_LATE_NOTICE: { channels: ["IN_APP", "PUSH"], optional: false, saturday: true },
  SAT_WINDOW_CLOSING: { channels: ["IN_APP", "PUSH"], optional: false, saturday: true },
  THU_DAY_BEFORE: { channels: ["EMAIL", "IN_APP", "PUSH"], optional: false, saturday: false },
  THU_HOUR_BEFORE: { channels: ["EMAIL", "IN_APP", "PUSH"], optional: false, saturday: false },
  THU_STARTING: { channels: ["IN_APP", "PUSH"], optional: false, saturday: false },
  ABSENCE_FOLLOWUP: { channels: ["EMAIL", "IN_APP"], optional: true, saturday: true },
  WEEKLY_SUMMARY: { channels: ["EMAIL"], optional: true, saturday: false },
  LOW_ATTENDANCE: { channels: ["EMAIL", "IN_APP"], optional: true, saturday: false },
  EVENT_DAY_BEFORE: { channels: ["EMAIL", "IN_APP", "PUSH"], optional: false, saturday: false },
  EVENT_HOUR_BEFORE: { channels: ["EMAIL", "IN_APP", "PUSH"], optional: false, saturday: false },
};

export interface SchedMeeting {
  id: string;
  type: MeetingType;
  startsAt: string;
  status: MeetingStatus;
  openBeforeMin: number;
  closeAfterMin: number;
  /** People with a check-in for this meeting (Saturday audiences). */
  checkedInUserIds?: string[];
  /** People recorded Absent without an approved excuse (absence follow-up). */
  absentUnexcusedUserIds?: string[];
  /** Special events: who was invited. Defaults to all active people. */
  invitedUserIds?: string[];
}

export interface SchedPerson {
  id: string;
  status: UserStatus;
  role: Role;
  isRemote: boolean;
  timezone: string;
  notifPrefs: NotifPrefs;
}

export interface PlanItem {
  type: NotificationType;
  at: DateTime;
  audience: Audience;
}

/**
 * Reminder times for one meeting, derived from its start time, so rescheduling moves them
 * and cancelling removes them (spec 8).
 */
export function reminderPlan(m: SchedMeeting): PlanItem[] {
  if (m.status === "CANCELLED") return [];
  const start = DateTime.fromISO(m.startsAt, { zone: "utc" });
  switch (m.type) {
    case "SATURDAY": {
      const closes = start.plus({ minutes: m.closeAfterMin });
      const followUp = start
        .setZone(MEETING_ZONE)
        .plus({ days: 1 })
        .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
        .toUTC();
      return [
        { type: "SAT_DAY_BEFORE", at: start.minus({ days: 1 }), audience: "ACTIVE" },
        { type: "SAT_HOUR_BEFORE", at: start.minus({ hours: 1 }), audience: "NOT_CHECKED_IN" },
        { type: "SAT_LATE_NOTICE", at: start, audience: "NOT_CHECKED_IN" },
        { type: "SAT_WINDOW_CLOSING", at: closes.minus({ minutes: 15 }), audience: "NOT_CHECKED_IN" },
        { type: "ABSENCE_FOLLOWUP", at: followUp, audience: "ABSENT_UNEXCUSED" },
      ];
    }
    case "THURSDAY_PRAYER":
      return [
        { type: "THU_DAY_BEFORE", at: start.minus({ days: 1 }), audience: "ACTIVE" },
        { type: "THU_HOUR_BEFORE", at: start.minus({ hours: 1 }), audience: "ACTIVE" },
        { type: "THU_STARTING", at: start, audience: "ACTIVE" },
      ];
    case "SPECIAL":
      return [
        { type: "EVENT_DAY_BEFORE", at: start.minus({ days: 1 }), audience: "INVITED" },
        { type: "EVENT_HOUR_BEFORE", at: start.minus({ hours: 1 }), audience: "INVITED" },
      ];
  }
}

export interface DueNotification {
  key: string;
  userId: string;
  meetingId: string | null;
  type: NotificationType;
  channels: Channel[];
  scheduledFor: string;
}

export const dedupeKey = (userId: string, meetingId: string, type: NotificationType) =>
  `${userId}:${meetingId}:${type}`;

const minuteOf = (d: DateTime) => Math.floor(d.toMillis() / 60_000);

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map(Number);
  return { h, m };
}

/**
 * If an optional message lands in the person's quiet hours (local time), defer it to the end
 * of quiet hours. Required messages are never deferred.
 */
export function applyQuietHours(at: DateTime, zone: string, quiet: { start: string; end: string } | null): DateTime {
  if (!quiet) return at;
  const local = at.setZone(zone);
  const s = parseHm(quiet.start);
  const e = parseHm(quiet.end);
  const minutes = local.hour * 60 + local.minute;
  const startM = s.h * 60 + s.m;
  const endM = e.h * 60 + e.m;
  const inQuiet = startM > endM ? minutes >= startM || minutes < endM : minutes >= startM && minutes < endM;
  if (!inQuiet) return at;
  let end = local.set({ hour: e.h, minute: e.m, second: 0, millisecond: 0 });
  if (end <= local) end = end.plus({ days: 1 });
  return end.toUTC();
}

function channelsFor(type: NotificationType, prefs: NotifPrefs): Channel[] {
  const spec = NOTIFICATION_TYPES[type];
  return spec.channels.filter((c) => {
    if (c === "PUSH") return prefs.push; // push is opt-in
    if (spec.optional && c === "EMAIL") return prefs.email;
    return true; // in-app always; email cannot be turned off for meeting reminders
  });
}

function audienceFor(item: PlanItem, m: SchedMeeting, active: SchedPerson[]): SchedPerson[] {
  const saturday = NOTIFICATION_TYPES[item.type].saturday;
  const base = saturday ? active.filter((p) => !p.isRemote) : active;
  switch (item.audience) {
    case "ACTIVE":
      return base;
    case "NOT_CHECKED_IN": {
      const done = new Set(m.checkedInUserIds ?? []);
      return base.filter((p) => !done.has(p.id));
    }
    case "ABSENT_UNEXCUSED": {
      const absent = new Set(m.absentUnexcusedUserIds ?? []);
      return base.filter((p) => absent.has(p.id));
    }
    case "INVITED": {
      if (!m.invitedUserIds) return base;
      const invited = new Set(m.invitedUserIds);
      return base.filter((p) => invited.has(p.id));
    }
  }
}

export function dueNotifications(
  now: DateTime,
  meetings: SchedMeeting[],
  people: SchedPerson[],
  alreadySent: Iterable<string>,
): DueNotification[] {
  const sent = new Set(alreadySent);
  const nowMinute = minuteOf(now);
  const active = people.filter((p) => p.status === "ACTIVE");
  const out: DueNotification[] = [];

  const push = (p: SchedPerson, meetingId: string, type: NotificationType, at: DateTime) => {
    const key = dedupeKey(p.id, meetingId, type);
    if (sent.has(key)) return;
    const channels = channelsFor(type, p.notifPrefs);
    if (!channels.length) return;
    sent.add(key);
    out.push({
      key,
      userId: p.id,
      meetingId: meetingId.startsWith("week-") ? null : meetingId,
      type,
      channels,
      scheduledFor: at.toISO()!,
    });
  };

  for (const m of meetings) {
    for (const item of reminderPlan(m)) {
      const spec = NOTIFICATION_TYPES[item.type];
      // Fast skip: optional items can be deferred up to 8 hours by quiet hours.
      const lag = nowMinute - minuteOf(item.at);
      if (lag < 0 || lag > (spec.optional ? 8 * 60 : 0)) continue;
      for (const p of audienceFor(item, m, active)) {
        if (spec.optional && !p.notifPrefs.nudges) continue;
        const at = spec.optional ? applyQuietHours(item.at, p.timezone, p.notifPrefs.quietHours) : item.at;
        if (minuteOf(at) === nowMinute) push(p, m.id, item.type, at);
      }
    }
  }

  // Weekly summary: Sunday 18:00 Lagos, every active person who wants it.
  const lagosNow = now.setZone(MEETING_ZONE);
  const sunday = lagosNow.startOf("week").plus({ days: 6 }).set({ hour: 18, minute: 0 }).toUTC();
  const weekId = `week-${lagosNow.toFormat("kkkk-'W'WW")}`;
  for (const p of active) {
    if (!p.notifPrefs.weeklySummary) continue;
    const at = applyQuietHours(sunday, p.timezone, p.notifPrefs.quietHours);
    if (minuteOf(at) === nowMinute) push(p, weekId, "WEEKLY_SUMMARY", at);
  }
  return out;
}

/** People who dropped below the threshold after a meeting (LOW_ATTENDANCE, event-driven). */
export function lowAttendanceCrossings(
  before: Map<string, number | null>,
  after: Map<string, number | null>,
  threshold = 60,
): string[] {
  const out: string[] = [];
  for (const [userId, pct] of after) {
    const prev = before.get(userId) ?? null;
    if (pct !== null && pct < threshold && (prev === null || prev >= threshold)) out.push(userId);
  }
  return out;
}
