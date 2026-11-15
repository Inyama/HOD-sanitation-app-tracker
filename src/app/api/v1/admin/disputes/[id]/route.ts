import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { decideDispute } from "@/lib/admin/ops-corrections";
import { parseJson } from "@/lib/http";
import { disputeDecisionBody } from "@/lib/validation/ops";

/** PATCH /api/v1/admin/disputes/:id: accept (and correct the record) or keep the record, with a note. */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/disputes/[id]">) {
  const auth = await adminRequest(req, "attendance.correct");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, disputeDecisionBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  return respond(await decideDispute(repo(), auth.ctx, id, body.data));
}
