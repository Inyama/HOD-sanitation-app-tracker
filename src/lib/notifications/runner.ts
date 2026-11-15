import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Meeting } from "@/lib/repo/types";
import { countedMeetings, tally } from "@/lib/attendance/aggregate";
import { attendancePercent } from "@/lib/attendance/percentage";
import { closeDueMeetings } from "@/lib/attendance/close-service";
import { meetingsBetween } from "@/lib/time/schedule";
import { automationConfig, effectiveTemplate, ruleLookup, schedulerWindow } from "./automation";
import { loadPeopleFacts, renderContextFor, type PeopleFacts } from "./context";
import { deliverEmail, deliverInApp, deliverPush, retryFailed } from "./deliver";
import { escalations } from "./escalation";
import { deliverMessage } from "./message-delivery";
import { dueNotificationsBetween, lowAttendanceCrossings, type DueNotification, type SchedMeeting } from "./schedule";
import { appUrl } from "./senders";
import { renderNotification } from "./templates";

/**
 * The notification scheduler (spec 6.7, 8). Each run covers the time since the last run:
 * it closes meetings whose check-in ended, sends due reminders exactly once (dedupe keys),
 * sends scheduled messages, escalates repeated absences, and retries failed emails.
 * Triggered every minute by the cron route, by the demo clock, or from the Automation screen.
 */

export interface RunSummary {
  from: string;
  to: string;
  trigger: string;
  closedMeetings: number;
  reminders: number;
  inApp: number;
  emails: number;
  failed: number;
  messages: number;
  escalations: number;
  lowAttendance: number;
  retried: number;
  /** Notifications created per person in this run (for the demo bell to refresh). */
  createdFor: string[];
}

interface SchedulerState {
  lastRunAt: string | null;
  lastSummary: RunSummary | null;
  running: Promise<RunSummary> | null;
}

const g = globalThis as unknown as { __hodScheduler?: SchedulerState };

export function schedulerState(): SchedulerState {
  if (!g.__hodScheduler) g.__hodScheduler = { lastRunAt: null, lastSummary: null, running: null };
  return g.__hodScheduler;
}

export function resetSchedulerState(): void {
  g.__hodScheduler = { lastRunAt: null, lastSummary: null, running: null };
}

const baseKey = (k: string) => k.replace(/:(IN_APP|EMAIL|PUSH|SMS|WHATSAPP)$/, "");

async function sentKeys(repo: Repository): Promise<Set<string>> {
  const [notes, deliveries] = await Promise.all([repo.notifications.list(), repo.deliveries.list()]);
  return new Set([...notes.map((n) => baseKey(n.dedupeKey)), ...deliveries.map((d) => d.key)]);
}

function schedMeetings(meetings: Meeting[], pf: PeopleFacts): SchedMeeting[] {
  return meetings.map((m) => {
    const recs = pf.records.filter((r) => r.meetingId === m.id);
    return {
      id: m.id,
      type: m.type,
      startsAt: m.startsAt,
      status: m.status,
      openBeforeMin: m.openBeforeMin,
      closeAfterMin: m.closeAfterMin,
      checkedInUserIds: recs.filter((r) => r.status === "ON_TIME" || r.status === "LATE").map((r) => r.userId),
      absentUnexcusedUserIds: recs.filter((r) => r.status === "ABSENT").map((r) => r.userId),
    };
  });
}

async function send(
  repo: Repository,
  pf: PeopleFacts,
  due: DueNotification,
  meetings: Map<string, Meeting>,
  now: DateTime,
) {
  const f = pf.facts.get(due.userId);
  if (!f) return { inApp: 0, emails: 0, failed: 0 };
  const m = due.meetingId ? meetings.get(due.meetingId) : undefined;
  const { rules } = automationConfig(pf.settings);
  const t = renderNotification(
    due.type,
    renderContextFor(pf, due.userId, { meetingName: m?.title, startsAt: m?.startsAt }),
    effectiveTemplate(due.type, rules[due.type]),
  );
  const input = { key: due.key, userId: due.userId, type: due.type, subject: t.subject, meetingId: due.meetingId };
  let inApp = 0;
  let emails = 0;
  let failed = 0;
  for (const c of due.channels) {
    if (c === "IN_APP") {
      await deliverInApp(repo, { ...input, title: t.title, body: t.body, scheduledFor: due.scheduledFor }, now);
      inApp++;
    } else if (c === "EMAIL") {
      const d = await deliverEmail(
        repo,
        {
          ...input,
          to: f.user.email,
          payload: {
            preheader: t.body.slice(0, 90),
            heading: t.title,
            paragraphs: [t.body],
            button:
              m && m.type !== "THURSDAY_PRAYER" ? { label: "Open the app", url: `${appUrl()}/member` } : undefined,
          },
        },
        now,
      );
      if (d.status === "SENT") emails++;
      else failed++;
    } else if (c === "PUSH") await deliverPush(repo, input, now);
  }
  return { inApp, emails, failed };
}

/** Tell the person and the admins when a meeting takes someone below the low-attendance threshold. */
export async function lowAttendanceAfter(
  repo: Repository,
  meetingId: string,
  now: DateTime,
  facts?: PeopleFacts,
): Promise<number> {
  const pf = facts ?? (await loadPeopleFacts(repo, now));
  const { rules } = automationConfig(pf.settings);
  if (!rules.LOW_ATTENDANCE.enabled) return 0;
  const meeting = pf.meetings.find((m) => m.id === meetingId);
  if (!meeting) return 0;
  const attendees = new Set(pf.records.filter((r) => r.meetingId === meetingId).map((r) => r.userId));
  const before = new Map<string, number | null>();
  const after = new Map<string, number | null>();
  const others = pf.meetings.filter((m) => m.id !== meetingId);
  for (const id of attendees) {
    const f = pf.facts.get(id);
    if (!f || f.user.status !== "ACTIVE" || f.user.role === "ADMIN") continue;
    const recs = pf.records.filter((r) => r.userId === id);
    before.set(
      id,
      attendancePercent(
        tally(countedMeetings(recs, others, { approvedAt: f.user.approvedAt, now }).map((c) => c.status)),
        pf.settings.lateWeight,
      ),
    );
    after.set(id, f.percent);
  }
  const crossed = lowAttendanceCrossings(before, after, pf.settings.lowAttendancePercent);
  const sent = await sentKeys(repo);
  let count = 0;
  for (const id of crossed) {
    const f = pf.facts.get(id)!;
    const key = `${id}:${meetingId}:LOW_ATTENDANCE`;
    if (sent.has(key) || !f.user.notifPrefs.nudges) continue;
    await send(
      repo,
      pf,
      {
        key,
        userId: id,
        meetingId,
        type: "LOW_ATTENDANCE",
        channels: rules.LOW_ATTENDANCE.email && f.user.notifPrefs.email ? ["IN_APP", "EMAIL"] : ["IN_APP"],
        scheduledFor: now.toISO()!,
      },
      new Map([[meeting.id, meeting]]),
      now,
    );
    count++;
  }
  if (crossed.length) {
    const admins = [...pf.facts.values()].filter(
      (f) =>
        f.user.role === "ADMIN" &&
        f.user.status === "ACTIVE" &&
        (f.user.adminLevel === "SUPER" || f.user.adminLevel === "UNIT"),
    );
    const names = crossed.map((id) => pf.facts.get(id)!.user.name);
    for (const a of admins) {
      const key = `${a.user.id}:${meetingId}:LOW_ATTENDANCE_FLAG`;
      if (sent.has(key)) continue;
      await deliverInApp(
        repo,
        {
          key,
          userId: a.user.id,
          type: "LOW_ATTENDANCE_FLAG",
          subject: "Attendance dropped below the threshold",
          title: `${crossed.length} ${crossed.length === 1 ? "person" : "people"} below ${pf.settings.lowAttendancePercent}%`,
          body: `After ${meeting.title}: ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` and ${names.length - 6} more` : ""}. They were sent an encouraging note.`,
          meetingId,
        },
        now,
      );
    }
  }
  return count;
}

async function runOnce(repo: Repository, now: DateTime, trigger: string): Promise<RunSummary> {
  const state = schedulerState();
  const { from, to } = schedulerWindow(state.lastRunAt, now);
  const summary: RunSummary = {
    from: from.toISO()!,
    to: to.toISO()!,
    trigger,
    closedMeetings: 0,
    reminders: 0,
    inApp: 0,
    emails: 0,
    failed: 0,
    messages: 0,
    escalations: 0,
    lowAttendance: 0,
    retried: 0,
    createdFor: [],
  };
  const created = new Set<string>();

  // 1. Close location meetings whose check-in ended in this window (absentees are written).
  const closed = (await closeDueMeetings(repo, from, now)).filter((c) => c.closed);
  summary.closedMeetings = closed.length;

  let pf = await loadPeopleFacts(repo, now);
  for (const c of closed) summary.lowAttendance += await lowAttendanceAfter(repo, c.id, now, pf);

  // 2. Scheduled messages that are due (sent even if the server was off at the time).
  const scheduled = (await repo.messages.list()).filter(
    (m) => !m.sentAt && !m.cancelledAt && m.scheduledFor && m.scheduledFor <= now.toISO()!,
  );
  for (const m of scheduled) {
    const r = await deliverMessage(repo, m, now, pf);
    summary.messages++;
    summary.emails += r.emails;
    (await repo.messageRecipients.list({ where: { messageId: m.id } })).forEach((x) => created.add(x.userId));
  }
  if (scheduled.length || closed.length) pf = await loadPeopleFacts(repo, now);

  // 3. Reminders due in the window.
  const meetings = meetingsBetween(await repo.meetings.list(), now.minus({ days: 2 }), now.plus({ days: 2 }));
  const byId = new Map(meetings.map((m) => [m.id, m]));
  const people = [...pf.facts.values()].map((f) => ({
    id: f.user.id,
    status: f.user.status,
    role: f.user.role,
    isRemote: f.user.isRemote,
    timezone: f.user.timezone,
    notifPrefs: f.user.notifPrefs,
  }));
  const due = dueNotificationsBetween(
    from,
    to,
    schedMeetings(meetings, pf),
    people,
    await sentKeys(repo),
    ruleLookup(pf.settings),
  );
  summary.reminders = due.length;
  for (const d of due) {
    const r = await send(repo, pf, d, byId, now);
    summary.inApp += r.inApp;
    summary.emails += r.emails;
    summary.failed += r.failed;
    if (r.inApp) created.add(d.userId);
  }

  // 4. Escalation: absence follow-ups that reached the threshold go to the Team Lead too.
  const { escalation } = automationConfig(pf.settings);
  if (escalation.enabled) {
    const followUps = due.filter((d) => d.type === "ABSENCE_FOLLOWUP" && d.meetingId);
    const sent = await sentKeys(repo);
    for (const meetingId of new Set(followUps.map((d) => d.meetingId!))) {
      const absent = followUps
        .filter((d) => d.meetingId === meetingId)
        .map((d) => pf.facts.get(d.userId)!)
        .filter(Boolean);
      const list = escalations(
        meetingId,
        absent.map((f) => ({
          userId: f.user.id,
          name: f.user.name,
          absencesInARow: f.absencesInARow,
          leadIds: pf.teams.filter((t) => f.teamIds.includes(t.id) && t.leadUserId).map((t) => t.leadUserId!),
        })),
        escalation.absences,
      ).filter((e) => !sent.has(e.key));
      for (const e of list) {
        const lead = pf.facts.get(e.leadId);
        if (!lead || lead.user.status !== "ACTIVE") continue;
        const title = `${e.name} has missed ${e.absences} meetings in a row`;
        const body = `As their Team Lead, could you check in with ${e.name.split(" ")[0]}? A short call or message often helps. You can send encouragement from My team.`;
        await deliverInApp(
          repo,
          { key: e.key, userId: e.leadId, type: "ESCALATION", subject: title, title, body, meetingId },
          now,
        );
        if (lead.user.notifPrefs.email)
          await deliverEmail(
            repo,
            {
              key: e.key,
              userId: e.leadId,
              type: "ESCALATION",
              subject: title,
              meetingId,
              to: lead.user.email,
              payload: {
                preheader: body.slice(0, 90),
                heading: title,
                paragraphs: [body],
                button: { label: "Open My team", url: `${appUrl()}/volunteer/team` },
              },
            },
            now,
          );
        created.add(e.leadId);
        summary.escalations++;
      }
    }
  }

  // 5. Retry failed emails whose back-off has passed.
  summary.retried = (await retryFailed(repo, now)).retried;

  summary.createdFor = [...created];
  state.lastRunAt = now.toISO()!;
  state.lastSummary = summary;
  return summary;
}

/** Run the scheduler once; overlapping calls wait for the run in progress instead of sending twice. */
export async function runScheduler(
  repo: Repository,
  now: DateTime,
  trigger: "cron" | "demo" | "admin",
): Promise<RunSummary> {
  const state = schedulerState();
  while (state.running) await state.running.catch(() => undefined);
  const run = runOnce(repo, now, trigger);
  state.running = run;
  try {
    return await run;
  } finally {
    state.running = null;
  }
}

export function lastRun(): { at: string | null; summary: RunSummary | null } {
  const s = schedulerState();
  return { at: s.lastRunAt, summary: s.lastSummary };
}
