import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { cancelScheduled } from "@/lib/admin/ops-messages";

/** POST /api/v1/admin/messages/:id/cancel: stop a scheduled message before it goes out. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/messages/[id]/cancel">) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  return respond(await cancelScheduled(repo(), auth.ctx, id));
}
