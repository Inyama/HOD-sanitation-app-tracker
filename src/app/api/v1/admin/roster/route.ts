import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf, respond } from "@/lib/admin/api";
import {
  applySuggestions,
  assignDuty,
  decideRosterSwap,
  loadRoster,
  publishRoster,
  removeDuty,
} from "@/lib/admin/ops-roster";
import { apiError, parseJson } from "@/lib/http";
import { rosterBody, rosterQuery } from "@/lib/validation/ops";

/** GET /api/v1/admin/roster?meetingId: zones, current duties, suggestions and swap requests. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "duties.manage");
  if (!auth.ok) return auth.res;
  const q = rosterQuery.safeParse(queryOf(req));
  if (!q.success) return apiError("VALIDATION_FAILED", "Check the meeting.", 422);
  const data = await loadRoster(repo(), auth.ctx.now, q.data.meetingId);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT /api/v1/admin/roster with { action }: assign, remove, applySuggestions, publish or swap. */
export async function PUT(req: NextRequest) {
  const auth = await adminRequest(req, "duties.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, rosterBody);
  if (!body.ok) return body.res;
  const r = repo();
  const b = body.data;
  switch (b.action) {
    case "assign":
      return respond(await assignDuty(r, auth.ctx, b.meetingId, b.userId, b.zoneId));
    case "remove":
      return respond(await removeDuty(r, auth.ctx, b.dutyId));
    case "applySuggestions":
      return respond(await applySuggestions(r, auth.ctx, b.meetingId, b.picks));
    case "publish":
      return respond(await publishRoster(r, auth.ctx, b.meetingId));
    case "swap":
      return respond(await decideRosterSwap(r, auth.ctx, b.dutyId, b.approve));
  }
}
