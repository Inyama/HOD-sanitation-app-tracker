import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Channel, Delivery, DeliveryStatus } from "@/lib/repo/types";
import { sendBrandedEmail } from "./senders";
import { MAX_ATTEMPTS, nextRetry } from "./automation";

/**
 * Delivering one notification or message on one channel, with a row in the delivery log
 * (spec 8: retries use exponential back-off, failures show in the delivery log).
 */

export interface DeliveryInput {
  key: string;
  userId: string;
  type: string;
  subject: string;
  messageId?: string | null;
  meetingId?: string | null;
}

export type EmailPayload = NonNullable<Delivery["payload"]>;

async function log(
  repo: Repository,
  input: DeliveryInput,
  channel: Channel,
  status: DeliveryStatus,
  now: DateTime,
  extra: Partial<Delivery> = {},
): Promise<Delivery> {
  return repo.deliveries.create({
    key: input.key,
    userId: input.userId,
    type: input.type,
    channel,
    status,
    attempts: status === "SKIPPED" ? 0 : 1,
    lastError: null,
    nextRetryAt: null,
    createdAt: now.toISO()!,
    sentAt: status === "SENT" ? now.toISO()! : null,
    subject: input.subject,
    messageId: input.messageId ?? null,
    meetingId: input.meetingId ?? null,
    payload: null,
    ...extra,
  });
}

/** An in-app notification plus its delivery-log row. */
export async function deliverInApp(
  repo: Repository,
  input: DeliveryInput & { title: string; body: string; scheduledFor?: string },
  now: DateTime,
) {
  const at = now.toISO()!;
  await repo.notifications.create({
    userId: input.userId,
    type: input.type,
    channel: "IN_APP",
    title: input.title,
    body: input.body.length > 400 ? `${input.body.slice(0, 397)}...` : input.body,
    scheduledFor: input.scheduledFor ?? at,
    sentAt: at,
    readAt: null,
    status: "SENT",
    dedupeKey: `${input.key}:IN_APP`,
  });
  return log(repo, input, "IN_APP", "SENT", now);
}

/** Send an email now; a failure is logged and retried later with back-off. */
export async function deliverEmail(
  repo: Repository,
  input: DeliveryInput & { to: string; payload: EmailPayload },
  now: DateTime,
) {
  try {
    await sendBrandedEmail(input.to, input.type, { subject: input.subject, ...input.payload });
    return log(repo, input, "EMAIL", "SENT", now, { payload: input.payload });
  } catch (e) {
    return log(repo, input, "EMAIL", "FAILED", now, {
      payload: input.payload,
      lastError: e instanceof Error ? e.message.slice(0, 200) : "Unknown error",
      nextRetryAt: nextRetry(1, now)?.toISO() ?? null,
    });
  }
}

/** Web push needs the service worker and VAPID keys (Phase 9); until then the attempt is logged as skipped. */
export async function deliverPush(repo: Repository, input: DeliveryInput, now: DateTime) {
  return log(repo, input, "PUSH", "SKIPPED", now, {
    lastError: "Web push is not set up yet (needs the service worker and VAPID keys).",
  });
}

/** Try failed emails whose back-off has passed. */
export async function retryFailed(repo: Repository, now: DateTime): Promise<{ retried: number; recovered: number }> {
  const due = (await repo.deliveries.list({ where: { status: "FAILED", channel: "EMAIL" } })).filter(
    (d) => d.nextRetryAt && d.nextRetryAt <= now.toISO()! && d.payload && d.attempts < MAX_ATTEMPTS,
  );
  let recovered = 0;
  for (const d of due) {
    const user = await repo.users.get(d.userId);
    const attempts = d.attempts + 1;
    if (!user || user.status !== "ACTIVE") {
      await repo.deliveries.update(d.id, {
        attempts,
        nextRetryAt: null,
        lastError: "The person can no longer receive messages.",
      });
      continue;
    }
    try {
      await sendBrandedEmail(user.email, d.type, { subject: d.subject, ...d.payload! });
      await repo.deliveries.update(d.id, {
        status: "SENT",
        attempts,
        sentAt: now.toISO()!,
        nextRetryAt: null,
        lastError: null,
      });
      recovered++;
    } catch (e) {
      await repo.deliveries.update(d.id, {
        attempts,
        lastError: e instanceof Error ? e.message.slice(0, 200) : "Unknown error",
        nextRetryAt: nextRetry(attempts, now)?.toISO() ?? null,
      });
    }
  }
  return { retried: due.length, recovered };
}
