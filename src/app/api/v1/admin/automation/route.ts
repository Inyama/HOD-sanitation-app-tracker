import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf, respond } from "@/lib/admin/api";
import { loadAutomation, updateAutomation } from "@/lib/admin/ops-automation";
import { apiError, parseJson } from "@/lib/http";
import { automationPatch, deliveryQuery } from "@/lib/validation/comms";

/** GET /api/v1/admin/automation?status&type: rules, escalation, coming schedule and the delivery log. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "automation.manage");
  if (!auth.ok) return auth.res;
  const q = deliveryQuery.safeParse(queryOf(req));
  if (!q.success) return apiError("VALIDATION_FAILED", "Check the filters.", 422);
  const data = await loadAutomation(repo(), auth.ctx.now, auth.ctx.admin.id, q.data);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

/** PATCH /api/v1/admin/automation: switch a notification on or off, change its channels or wording, or the escalation rule. */
export async function PATCH(req: NextRequest) {
  const auth = await adminRequest(req, "automation.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, automationPatch);
  if (!body.ok) return body.res;
  return respond(await updateAutomation(repo(), auth.ctx, body.data));
}
