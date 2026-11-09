import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { decideDeletion } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { deletionDecisionBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/members/:id/deletion: confirm or decline a deletion request. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]/deletion">) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, deletionDecisionBody);
  if (!body.ok) return body.res;
  return respond(await decideDeletion(repo(), auth.ctx, (await params).id, body.data.confirm));
}
