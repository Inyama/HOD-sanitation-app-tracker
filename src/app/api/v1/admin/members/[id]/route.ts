import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { loadProfile } from "@/lib/admin/data";
import { removeMember, updateMember } from "@/lib/admin/service";
import { apiError, parseJson } from "@/lib/http";
import { removeMemberBody, updateMemberBody } from "@/lib/validation/admin";

/** GET /api/v1/admin/members/:id: the member profile. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]">) {
  const auth = await adminRequest(req, "people.view");
  if (!auth.ok) return auth.res;
  const profile = await loadProfile(repo(), (await params).id, auth.ctx.now);
  if (!profile) return apiError("NOT_FOUND", "We could not find that person.", 404);
  return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
}

/** PATCH /api/v1/admin/members/:id: edit details and team. */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]">) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, updateMemberBody);
  if (!body.ok) return body.res;
  return respond(await updateMember(repo(), auth.ctx, (await params).id, body.data));
}

/** DELETE /api/v1/admin/members/:id: soft delete with a reason (kept 30 days). */
export async function DELETE(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]">) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, removeMemberBody);
  if (!body.ok) return body.res;
  return respond(await removeMember(repo(), auth.ctx, (await params).id, body.data.reason));
}
