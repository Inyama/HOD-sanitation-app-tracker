import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Meeting, User } from "@/lib/repo/types";
import { recurringMeetingById } from "@/lib/time/schedule";

/** Shared helpers for the admin operations services (audit, notices, meeting lookup). */

export interface OpsContext {
  admin: User;
  ip: string;
  now: DateTime;
}

export type Fail = { ok: false; code: string; message: string; status: number };
export const fail = (code: string, message: string, status = 400): Fail => ({ ok: false, code, message, status });

export async function audit(
  repo: Repository,
  ctx: OpsContext,
  action: string,
  entity: string,
  entityId: string | null,
  before: unknown = null,
  after: unknown = null,
) {
  await repo.audit.append({
    actorId: ctx.admin.id,
    action,
    entity,
    entityId,
    before,
    after,
    ip: ctx.ip,
    createdAt: ctx.now.toISO()!,
  });
}

/** In-app notice to one person (emails for meeting changes are sent by the caller). */
export async function notify(
  repo: Repository,
  ctx: OpsContext,
  userId: string,
  type: string,
  title: string,
  body: string,
  key?: string,
) {
  const at = ctx.now.toISO()!;
  await repo.notifications.create({
    userId,
    type,
    channel: "IN_APP",
    title,
    body,
    scheduledFor: at,
    sentAt: at,
    readAt: null,
    status: "SENT",
    dedupeKey: key ?? `${userId}:${type}:${at}`,
  });
}

/** A stored meeting, or a weekly one (past or future) saved on first use. */
export async function materializeMeeting(repo: Repository, id: string): Promise<Meeting | null> {
  const stored = await repo.meetings.get(id);
  if (stored) return stored;
  const settings = await repo.settings.get();
  const generated = recurringMeetingById(id, settings.venueId);
  return generated ? repo.meetings.create(generated) : null;
}
