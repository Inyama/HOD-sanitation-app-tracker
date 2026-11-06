import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { now } from "@/lib/time/clock";

/** PATCH /api/v1/me/notifications/:id/read */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("notifications.own");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const n = await repo().notifications.get(id);
  if (!n || n.userId !== auth.current.user.id) return apiError("NOT_FOUND", "Notification not found.", 404);
  const updated = n.readAt ? n : await repo().notifications.update(id, { readAt: now().toISO()!, status: "READ" });
  return NextResponse.json({ ok: true, notification: updated });
}
