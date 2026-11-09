import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { setMemberStatus } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { statusBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/members/:id/status: suspend (with reason), reactivate or restore. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]/status">) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, statusBody);
  if (!body.ok) return body.res;
  return respond(await setMemberStatus(repo(), auth.ctx, (await params).id, body.data));
}
