import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { decideSignup } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { approveBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/members/:id/approve: approve, or decline with a reason. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]/approve">) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, approveBody);
  if (!body.ok) return body.res;
  return respond(await decideSignup(repo(), auth.ctx, (await params).id, body.data));
}
