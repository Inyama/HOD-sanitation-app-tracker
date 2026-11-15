import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { createAnnouncement } from "@/lib/admin/ops-messages";
import { parseJson } from "@/lib/http";
import { announcementBody } from "@/lib/validation/comms";

/** GET /api/v1/admin/announcements: every announcement, newest first. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const items = await repo().announcements.list({ orderBy: { field: "createdAt", dir: "desc" } });
  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/v1/admin/announcements: post an update to the Events feed (optionally pinned, optionally notify). */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, announcementBody);
  if (!body.ok) return body.res;
  return respond(await createAnnouncement(repo(), auth.ctx, body.data), 201);
}
