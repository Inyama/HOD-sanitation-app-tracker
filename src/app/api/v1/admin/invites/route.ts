import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { inviteAdmin } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { inviteBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/invites: invite an admin (Super Admin only; admins join by invitation). */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "roles.assignAdminLevel");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, inviteBody);
  if (!body.ok) return body.res;
  return respond(await inviteAdmin(repo(), auth.ctx, body.data.email, body.data.adminLevel), 201);
}
