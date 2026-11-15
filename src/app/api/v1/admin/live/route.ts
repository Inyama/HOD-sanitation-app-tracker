import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf } from "@/lib/admin/api";
import { loadLiveBoard } from "@/lib/admin/ops-live";
import { apiError } from "@/lib/http";
import { liveQuery } from "@/lib/validation/ops";

/** GET /api/v1/admin/live?meetingId: counters, map dots and the live list (spec 7.4 item 2). */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "stats.unit");
  if (!auth.ok) return auth.res;
  const q = liveQuery.safeParse(queryOf(req));
  if (!q.success) return apiError("VALIDATION_FAILED", "Check the meeting.", 422);
  const data = await loadLiveBoard(repo(), auth.ctx.now, q.data.meetingId);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}
