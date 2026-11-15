import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AutomationRule, AutomationSettings } from "@/lib/repo/types";
import {
  AUTOMATION_META,
  AUTOMATION_ORDER,
  automationConfig,
  effectiveTemplate,
  ruleChannels,
  ruleLookup,
  upcomingSchedule,
} from "@/lib/notifications/automation";
import { loadPeopleFacts, renderContextFor } from "@/lib/notifications/context";
import { deliverEmail, deliverInApp } from "@/lib/notifications/deliver";
import { lastRun } from "@/lib/notifications/runner";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications/schedule";
import { TEMPLATES, mergeValues, renderNotification } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/notifications/senders";
import { meetingsBetween } from "@/lib/time/schedule";
import { audit, fail, type OpsContext } from "./ops-common";

/** Reminders and automation (spec 7.4 item 11). */

export async function loadAutomation(
  repo: Repository,
  now: DateTime,
  adminId: string,
  filters: { status: string; type: string },
) {
  const [settings, deliveries, users, stored] = await Promise.all([
    repo.settings.get(),
    repo.deliveries.list(),
    repo.users.list(),
    repo.meetings.list(),
  ]);
  const config = automationConfig(settings);
  const pf = await loadPeopleFacts(repo, now);
  const meetings = meetingsBetween(stored, now.minus({ days: 1 }), now.plus({ days: 8 }));
  const next = (type: string) =>
    meetings.find((m) => m.type === type && m.status !== "CANCELLED" && m.startsAt > now.toISO()!);
  const name = new Map(users.map((u) => [u.id, u.name]));
  const sampleFor = (t: NotificationType) => {
    const m =
      t.startsWith("SAT") || t === "ABSENCE_FOLLOWUP"
        ? next("SATURDAY")
        : t.startsWith("THU")
          ? next("THURSDAY_PRAYER")
          : t.startsWith("EVENT")
            ? next("SPECIAL")
            : undefined;
    return mergeValues(
      renderContextFor(pf, adminId, {
        meetingName: m?.title ?? "Deep Clean Day",
        startsAt: m?.startsAt ?? now.plus({ days: 1 }).toISO()!,
      }),
    );
  };
  const filtered = deliveries
    .filter((d) => filters.status === "ALL" || d.status === filters.status)
    .filter((d) => filters.type === "ALL" || d.type === filters.type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const run = lastRun();
  return {
    rules: AUTOMATION_ORDER.map((t) => ({
      type: t,
      ...AUTOMATION_META[t],
      optional: NOTIFICATION_TYPES[t].optional,
      available: NOTIFICATION_TYPES[t].channels,
      rule: config.rules[t],
      channels: ruleChannels(t, config.rules[t]),
      defaults: TEMPLATES[t],
      template: effectiveTemplate(t, config.rules[t]),
      sample: sampleFor(t),
    })),
    escalation: config.escalation,
    schedule: upcomingSchedule(
      meetings.map((m) => ({
        id: m.id,
        type: m.type,
        startsAt: m.startsAt,
        status: m.status,
        openBeforeMin: m.openBeforeMin,
        closeAfterMin: m.closeAfterMin,
        title: m.title,
      })),
      now,
      7,
      ruleLookup(settings),
    ),
    deliveries: filtered.slice(0, 80).map((d) => ({
      id: d.id,
      createdAt: d.createdAt,
      person: name.get(d.userId) ?? "Unknown",
      type: d.type,
      channel: d.channel,
      status: d.status,
      attempts: d.attempts,
      lastError: d.lastError,
      nextRetryAt: d.nextRetryAt,
      subject: d.subject,
    })),
    totals: {
      sent: deliveries.filter((d) => d.status === "SENT").length,
      failed: deliveries.filter((d) => d.status === "FAILED").length,
      skipped: deliveries.filter((d) => d.status === "SKIPPED").length,
      retrying: deliveries.filter((d) => d.status === "FAILED" && d.nextRetryAt).length,
    },
    types: [...new Set(deliveries.map((d) => d.type))].sort(),
    lastRun: run,
    venueAddress: pf.venueAddress,
  };
}

export type AutomationData = Awaited<ReturnType<typeof loadAutomation>>;

export async function updateAutomation(
  repo: Repository,
  ctx: OpsContext,
  patch:
    | ({ target: "rule"; type: NotificationType } & Partial<
        Pick<AutomationRule, "enabled" | "email" | "push" | "subject" | "title" | "body">
      >)
    | { target: "escalation"; enabled: boolean; absences: number },
) {
  const settings = await repo.settings.get();
  const current = automationConfig(settings);
  const saved: AutomationSettings = {
    rules: { ...(settings.automation?.rules ?? {}) },
    escalation: current.escalation,
  };
  let before: unknown;
  let after: unknown;
  let entityId: string;
  if (patch.target === "rule") {
    const { target: _t, type, ...changes } = patch;
    void _t;
    const old = current.rules[type];
    if (changes.email && !NOTIFICATION_TYPES[type].channels.includes("EMAIL"))
      return fail("NO_EMAIL", "This notification is in-app only.", 422);
    if (changes.push && !NOTIFICATION_TYPES[type].channels.includes("PUSH"))
      return fail("NO_PUSH", "This notification has no push channel.", 422);
    const next = { ...old, ...changes };
    saved.rules[type] = next;
    entityId = type;
    const keys = Object.keys(changes) as (keyof AutomationRule)[];
    before = Object.fromEntries(keys.map((k) => [k, old[k]]));
    after = Object.fromEntries(keys.map((k) => [k, next[k]]));
  } else {
    before = current.escalation;
    saved.escalation = { enabled: patch.enabled, absences: patch.absences };
    after = saved.escalation;
    entityId = "ESCALATION";
  }
  await repo.settings.update({ automation: saved });
  await audit(repo, ctx, "AUTOMATION_UPDATED", "Automation", entityId, before, after);
  return { ok: true as const };
}

/** "Send test to me": render with the admin's own details and deliver in-app and by email. */
export async function sendTest(repo: Repository, ctx: OpsContext, type: NotificationType) {
  const [settings, stored] = await Promise.all([repo.settings.get(), repo.meetings.list()]);
  const pf = await loadPeopleFacts(repo, ctx.now);
  const kind =
    type.startsWith("SAT") || type === "ABSENCE_FOLLOWUP"
      ? "SATURDAY"
      : type.startsWith("THU")
        ? "THURSDAY_PRAYER"
        : type.startsWith("EVENT")
          ? "SPECIAL"
          : null;
  const m = kind
    ? meetingsBetween(stored, ctx.now, ctx.now.plus({ weeks: 6 })).find(
        (x) => x.type === kind && x.status !== "CANCELLED" && x.startsAt > ctx.now.toISO()!,
      )
    : undefined;
  const t = renderNotification(
    type,
    renderContextFor(pf, ctx.admin.id, { meetingName: m?.title, startsAt: m?.startsAt }),
    effectiveTemplate(type, automationConfig(settings).rules[type]),
  );
  const key = `${ctx.admin.id}:test-${ctx.now.toMillis()}:${type}`;
  const input = { key, userId: ctx.admin.id, type: "TEST", subject: `[Test] ${t.subject}` };
  await deliverInApp(repo, { ...input, title: `[Test] ${t.title}`, body: t.body }, ctx.now);
  const email = await deliverEmail(
    repo,
    {
      ...input,
      to: ctx.admin.email,
      payload: {
        preheader: t.body.slice(0, 90),
        heading: t.title,
        paragraphs: [t.body],
        button: { label: "Open the app", url: `${appUrl()}/admin` },
      },
    },
    ctx.now,
  );
  await audit(repo, ctx, "AUTOMATION_TEST_SENT", "Automation", type, null, { email: email.status });
  return { ok: true as const, email: email.status };
}
