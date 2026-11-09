import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { updateSettings } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { settingsBody } from "@/lib/validation/admin";

/** GET /api/v1/admin/settings: settings plus the venue pin (Super Admin). */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "settings.manage");
  if (!auth.ok) return auth.res;
  const r = repo();
  const settings = await r.settings.get();
  const venue = await r.venues.get(settings.venueId);
  return NextResponse.json({ settings, venue }, { headers: { "Cache-Control": "no-store" } });
}

/** PATCH /api/v1/admin/settings: save all settings; the audit log keeps what changed. */
export async function PATCH(req: NextRequest) {
  const auth = await adminRequest(req, "settings.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, settingsBody);
  if (!body.ok) return body.res;
  return respond(await updateSettings(repo(), auth.ctx, body.data));
}
