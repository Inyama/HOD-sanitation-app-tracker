import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { createDispute } from "@/lib/admin/ops-corrections";
import { apiError, parseJson } from "@/lib/http";
import { disputeCreateBody } from "@/lib/validation/ops";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/me/disputes: my attendance queries. */
export async function GET() {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const items = await repo().disputes.list({
    where: { userId: auth.current.user.id },
    orderBy: { field: "createdAt", dir: "desc" },
  });
  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/v1/me/disputes: tell the admins one of my records is wrong (goes to Corrections). */
export async function POST(req: NextRequest) {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, disputeCreateBody);
  if (!body.ok) return body.res;
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const res = await createDispute(repo(), auth.current.user, now, body.data);
  if (!res.ok) return apiError(res.code, res.message, res.status);
  return NextResponse.json(res, { status: 201 });
}
