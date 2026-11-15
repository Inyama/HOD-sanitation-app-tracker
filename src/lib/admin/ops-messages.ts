import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AudienceSpec, Message } from "@/lib/repo/types";
import { authStore } from "@/lib/auth/store";
import { describeAudience, resolveAudience } from "@/lib/notifications/audience";
import { audiencePeople, loadPeopleFacts } from "@/lib/notifications/context";
import { deliverInApp } from "@/lib/notifications/deliver";
import { deliverMessage } from "@/lib/notifications/message-delivery";
import { MEETING_ZONE } from "@/lib/time/zone";
import type { MessageBody } from "@/lib/validation/comms";
import { audit, fail, type OpsContext } from "./ops-common";

/** Messaging center (spec 7.4 item 10): compose to an audience, schedule, delivery report, announcements. */

const MAX_SCHEDULE_DAYS = 60;

export async function loadMessagingScreen(repo: Repository, now: DateTime) {
  const pf = await loadPeopleFacts(repo, now);
  const [messages, recipients, deliveries, announcements, users] = await Promise.all([
    repo.messages.list(),
    repo.messageRecipients.list(),
    repo.deliveries.list({ where: { type: "MESSAGE" } }),
    repo.announcements.list({ orderBy: { field: "createdAt", dir: "desc" } }),
    repo.users.list(),
  ]);
  const name = new Map(users.map((u) => [u.id, u.name]));
  const teamName = new Map(pf.teams.map((t) => [t.id, t.name]));
  const history = messages
    .map((m) => {
      const rs = recipients.filter((r) => r.messageId === m.id);
      const ds = deliveries.filter((d) => d.messageId === m.id && d.channel === "EMAIL");
      return {
        id: m.id,
        subject: m.subject,
        sender: name.get(m.senderId) ?? "Admin",
        audience: describeAudience(m.audience, (id) => teamName.get(id) ?? "team"),
        channels: m.channels,
        status: m.cancelledAt ? ("CANCELLED" as const) : m.sentAt ? ("SENT" as const) : ("SCHEDULED" as const),
        sentAt: m.sentAt,
        scheduledFor: m.scheduledFor,
        recipients: rs.length,
        read: rs.filter((r) => r.readAt).length,
        emailsSent: ds.filter((d) => d.status === "SENT").length,
        emailsFailed: ds.filter((d) => d.status === "FAILED").length,
        attachments: m.attachments?.length ?? 0,
      };
    })
    .sort((a, b) => (b.sentAt ?? b.scheduledFor ?? "").localeCompare(a.sentAt ?? a.scheduledFor ?? ""));
  return {
    people: [...pf.facts.values()]
      .filter((f) => f.user.status === "ACTIVE")
      .map((f) => ({
        id: f.user.id,
        name: f.user.name,
        role: f.user.role,
        status: f.user.status,
        teamIds: f.teamIds,
        band: f.bandKey,
        bandLabel: f.bandLabel,
        percent: f.percent,
        absentLastSaturday: f.absentLastSaturday,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    teams: pf.teams.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)),
    nextMeeting: pf.nextMeetingText,
    history,
    announcements: announcements.map((a) => ({ ...a, author: name.get(a.authorId) ?? "Admin" })),
  };
}

export type MessagingData = Awaited<ReturnType<typeof loadMessagingScreen>>;

function audienceOf(input: MessageBody): AudienceSpec {
  return input.audience ?? { kind: "HAND_PICKED", userIds: input.userIds! };
}

export async function sendMessage(repo: Repository, ctx: OpsContext, input: MessageBody) {
  const audience = audienceOf(input);
  for (const a of input.attachments ?? []) {
    const fileId = a.url.split("/").pop()!;
    if (authStore().files.get(fileId)?.ownerId !== ctx.admin.id)
      return fail("BAD_ATTACHMENT", `Upload ${a.name} again.`, 422);
  }
  let scheduledFor: string | null = null;
  if (input.scheduledFor) {
    const at = DateTime.fromISO(input.scheduledFor, { zone: MEETING_ZONE });
    if (!at.isValid) return fail("BAD_DATE", "Choose a valid date and time.", 422);
    if (at <= ctx.now.plus({ minutes: 1 }))
      return fail("IN_PAST", "Choose a time at least a few minutes from now, or send it now.", 422);
    if (at > ctx.now.plus({ days: MAX_SCHEDULE_DAYS }))
      return fail("TOO_FAR", `Schedule at most ${MAX_SCHEDULE_DAYS} days ahead.`, 422);
    scheduledFor = at.toUTC().toISO()!;
  }
  const pf = await loadPeopleFacts(repo, ctx.now);
  const count = resolveAudience(audience, audiencePeople(pf)).length;
  if (count === 0) return fail("NO_RECIPIENTS", "Nobody matches this audience right now.", 422);

  const message = await repo.messages.create({
    senderId: ctx.admin.id,
    subject: input.subject,
    body: input.body,
    audience,
    channels: input.channels,
    scheduledFor,
    sentAt: null,
    attachments: input.attachments ?? [],
    cancelledAt: null,
    templateKey: input.templateKey ?? null,
  } satisfies Omit<Message, "id">);
  const teamName = (id: string) => pf.teams.find((t) => t.id === id)?.name ?? "team";
  if (scheduledFor) {
    await audit(repo, ctx, "MESSAGE_SCHEDULED", "Message", message.id, null, {
      subject: input.subject,
      audience: describeAudience(audience, teamName),
      scheduledFor,
      recipientsNow: count,
    });
    return { ok: true as const, messageId: message.id, scheduled: true, recipients: count };
  }
  const r = await deliverMessage(repo, message, ctx.now, pf);
  await audit(repo, ctx, "MESSAGE_SENT", "Message", message.id, null, {
    subject: input.subject,
    audience: describeAudience(audience, teamName),
    recipients: r.recipients,
    channels: input.channels,
  });
  return { ok: true as const, messageId: message.id, scheduled: false, recipients: r.recipients };
}

export async function cancelScheduled(repo: Repository, ctx: OpsContext, id: string) {
  const m = await repo.messages.get(id);
  if (!m) return fail("NOT_FOUND", "Message not found.", 404);
  if (m.sentAt) return fail("ALREADY_SENT", "This message has already gone out.", 409);
  if (m.cancelledAt) return fail("ALREADY_CANCELLED", "This message was already cancelled.", 409);
  await repo.messages.update(id, { cancelledAt: ctx.now.toISO()! });
  await audit(repo, ctx, "MESSAGE_CANCELLED", "Message", id, { scheduledFor: m.scheduledFor }, { cancelled: true });
  return { ok: true as const };
}

export async function deliveryReport(repo: Repository, id: string) {
  const m = await repo.messages.get(id);
  if (!m) return null;
  const [recipients, deliveries, users] = await Promise.all([
    repo.messageRecipients.list({ where: { messageId: id } }),
    repo.deliveries.list({ where: { messageId: id } }),
    repo.users.list(),
  ]);
  const user = new Map(users.map((u) => [u.id, u]));
  return {
    message: {
      id: m.id,
      subject: m.subject,
      sentAt: m.sentAt,
      scheduledFor: m.scheduledFor,
      channels: m.channels,
      body: m.body,
    },
    rows: recipients
      .map((r) => {
        const email = deliveries.find((d) => d.userId === r.userId && d.channel === "EMAIL");
        return {
          userId: r.userId,
          name: user.get(r.userId)?.name ?? "Unknown",
          deliveredAt: r.deliveredAt,
          readAt: r.readAt,
          email: email ? { status: email.status, error: email.lastError } : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---- Announcements ---------------------------------------------------------------------------

export async function createAnnouncement(
  repo: Repository,
  ctx: OpsContext,
  input: { title: string; body: string; pinned: boolean; notify: boolean },
) {
  const a = await repo.announcements.create({
    title: input.title,
    body: input.body,
    pinned: input.pinned,
    authorId: ctx.admin.id,
    createdAt: ctx.now.toISO()!,
  });
  let told = 0;
  if (input.notify) {
    for (const u of await repo.users.list({ where: { status: "ACTIVE" } })) {
      await deliverInApp(
        repo,
        {
          key: `${u.id}:${a.id}:ANNOUNCEMENT`,
          userId: u.id,
          type: "ANNOUNCEMENT",
          subject: input.title,
          title: input.title,
          body: input.body,
        },
        ctx.now,
      );
      told++;
    }
  }
  await audit(repo, ctx, "ANNOUNCEMENT_POSTED", "Announcement", a.id, null, {
    title: input.title,
    pinned: input.pinned,
    told,
  });
  return { ok: true as const, id: a.id, told };
}

export async function updateAnnouncement(
  repo: Repository,
  ctx: OpsContext,
  id: string,
  patch: { title?: string; body?: string; pinned?: boolean },
) {
  const a = await repo.announcements.get(id);
  if (!a) return fail("NOT_FOUND", "Announcement not found.", 404);
  await repo.announcements.update(id, patch);
  await audit(
    repo,
    ctx,
    "ANNOUNCEMENT_UPDATED",
    "Announcement",
    id,
    Object.fromEntries(Object.keys(patch).map((k) => [k, a[k as keyof typeof a]])),
    patch,
  );
  return { ok: true as const };
}

export async function deleteAnnouncement(repo: Repository, ctx: OpsContext, id: string) {
  const a = await repo.announcements.get(id);
  if (!a) return fail("NOT_FOUND", "Announcement not found.", 404);
  await repo.announcements.delete(id);
  await audit(repo, ctx, "ANNOUNCEMENT_DELETED", "Announcement", id, { title: a.title }, null);
  return { ok: true as const };
}
