import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { changeRole } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { roleBody } from "@/lib/validation/admin";

/** PATCH /api/v1/admin/members/:id/role: primary role, admin level and titles. */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]/role">) {
  const auth = await adminRequest(req, "roles.assign");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, roleBody);
  if (!body.ok) return body.res;
  return respond(await changeRole(repo(), auth.ctx, (await params).id, body.data));
}
