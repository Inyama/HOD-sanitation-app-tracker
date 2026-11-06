import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { loadInbox } from "@/lib/member/inbox";

/** GET /api/v1/me/messages: messages from admins, newest first. */
export async function GET() {
  const auth = await apiUser("notifications.own");
  if (!auth.ok) return auth.res;
  return NextResponse.json({ items: await loadInbox(auth.current.user) });
}
