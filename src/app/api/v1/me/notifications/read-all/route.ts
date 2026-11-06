import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { now } from "@/lib/time/clock";

/** POST /api/v1/me/notifications/read-all */
export async function POST() {
  const auth = await apiUser("notifications.own");
  if (!auth.ok) return auth.res;
  const r = repo();
  const unread = (await r.notifications.list({ where: { userId: auth.current.user.id, channel: "IN_APP" } })).filter(
    (n) => !n.readAt,
  );
  const at = now().toISO()!;
  for (const n of unread) await r.notifications.update(n.id, { readAt: at, status: "READ" });
  return NextResponse.json({ ok: true, marked: unread.length });
}
