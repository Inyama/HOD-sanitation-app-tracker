import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { bulkMembers } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { bulkMembersBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/members/bulk: assign a team to, or suspend, several people. */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, bulkMembersBody);
  if (!body.ok) return body.res;
  return respond(await bulkMembers(repo(), auth.ctx, body.data));
}
