import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf } from "@/lib/admin/api";
import { loadAnalytics } from "@/lib/admin/ops-reports";
import { apiError } from "@/lib/http";
import { analyticsQuery } from "@/lib/validation/ops";

/** GET /api/v1/admin/analytics?range&meetingType&teamId: cohorts, punctuality, drop-off, leaderboard. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "stats.unit");
  if (!auth.ok) return auth.res;
  const q = analyticsQuery.safeParse(queryOf(req));
  if (!q.success) return apiError("VALIDATION_FAILED", "Check the filters.", 422);
  const data = await loadAnalytics(repo(), auth.ctx.now, q.data.range, q.data);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}
