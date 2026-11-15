import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { loadMessagingScreen, sendMessage } from "@/lib/admin/ops-messages";
import { parseJson } from "@/lib/http";
import { messageBody } from "@/lib/validation/comms";

/** GET /api/v1/admin/messages: audience data, message history with delivery counts, announcements. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const data = await loadMessagingScreen(repo(), auth.ctx.now);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/v1/admin/messages: send to an audience (or hand-picked userIds) now, or schedule it.
 * Channels: in-app and email; merge fields are filled per person.
 */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, messageBody);
  if (!body.ok) return body.res;
  return respond(await sendMessage(repo(), auth.ctx, body.data), 201);
}
