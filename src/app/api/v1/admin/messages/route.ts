import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { sendDirectMessage } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { directMessageBody } from "@/lib/validation/admin";

/**
 * POST /api/v1/admin/messages: message hand-picked people (in-app and email).
 * Phase 7 extends this with the full audience builder, templates and scheduling.
 */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, directMessageBody);
  if (!body.ok) return body.res;
  return respond(await sendDirectMessage(repo(), auth.ctx, body.data), 201);
}
