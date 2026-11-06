import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { parseJson } from "@/lib/http";
import { preferencesPatch } from "@/lib/validation/member";

/**
 * PATCH /api/v1/me/preferences: reminder channels and quiet hours (spec 8).
 * In-app is always on; meeting reminders and account emails cannot be turned off.
 */
export async function PATCH(req: NextRequest) {
  const auth = await apiUser("notifications.own");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, preferencesPatch);
  if (!body.ok) return body.res;
  const u = auth.current.user;
  const notifPrefs = { ...u.notifPrefs, ...body.data, inApp: true };
  await repo().users.update(u.id, { notifPrefs });
  return NextResponse.json({ ok: true, notifPrefs });
}
