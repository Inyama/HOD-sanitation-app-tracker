import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { sendTest } from "@/lib/admin/ops-automation";
import { parseJson } from "@/lib/http";
import { automationTestBody } from "@/lib/validation/comms";

/** POST /api/v1/admin/automation/test: send one notification to me, in-app and by email. */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "automation.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, automationTestBody);
  if (!body.ok) return body.res;
  return respond(await sendTest(repo(), auth.ctx, body.data.type));
}
