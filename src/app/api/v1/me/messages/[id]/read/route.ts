import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { now } from "@/lib/time/clock";

/** PATCH /api/v1/me/messages/:id/read (id is the message id). */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("notifications.own");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const rec = await repo().messageRecipients.findFirst({ messageId: id, userId: auth.current.user.id });
  if (!rec) return apiError("NOT_FOUND", "Message not found.", 404);
  if (!rec.readAt) await repo().messageRecipients.update(rec.id, { readAt: now().toISO()! });
  return NextResponse.json({ ok: true });
}
