import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest } from "@/lib/admin/api";
import { loadDashboard } from "@/lib/admin/data";
import { encodeCustomRange, RANGE_COOKIE } from "@/lib/admin/range";

/** GET /api/v1/admin/dashboard?from&to (or ?range=12w): the dashboard figures (spec 11). */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "stats.unit");
  if (!auth.ok) return auth.res;
  const q = req.nextUrl.searchParams;
  const from = q.get("from");
  const to = q.get("to");
  const value =
    from && to ? encodeCustomRange(from, to) : (q.get("range") ?? req.cookies.get(RANGE_COOKIE)?.value ?? undefined);
  const data = await loadDashboard(repo(), value, auth.ctx.now);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
