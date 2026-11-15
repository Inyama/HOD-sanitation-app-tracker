import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { decideExcuse } from "@/lib/admin/ops-excuses";
import { parseJson } from "@/lib/http";
import { excuseDecisionBody } from "@/lib/validation/ops";

/** PATCH /api/v1/admin/excuses/:id: approve (Absent becomes Excused) or decline with a note (spec 6.6). */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/excuses/[id]">) {
  const auth = await adminRequest(req, "excuse.review");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, excuseDecisionBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  return respond(await decideExcuse(repo(), auth.ctx, id, body.data.decision, body.data.note));
}
