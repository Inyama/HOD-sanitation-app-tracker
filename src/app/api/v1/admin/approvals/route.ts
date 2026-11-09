import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { bulkApprove } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { bulkApproveBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/approvals: approve several pending sign-ups at once. */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, bulkApproveBody);
  if (!body.ok) return body.res;
  return respond(await bulkApprove(repo(), auth.ctx, body.data.ids));
}
