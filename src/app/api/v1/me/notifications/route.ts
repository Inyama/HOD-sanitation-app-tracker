import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";

/** GET /api/v1/me/notifications: in-app notifications, newest first. */
export async function GET() {
  const auth = await apiUser("notifications.own");
  if (!auth.ok) return auth.res;
  const items = await repo().notifications.list({
    where: { userId: auth.current.user.id, channel: "IN_APP" },
    orderBy: { field: "scheduledFor", dir: "desc" },
  });
  return NextResponse.json({ items, unread: items.filter((n) => !n.readAt).length });
}
