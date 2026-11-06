import { NextResponse, type NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { reportFor } from "@/lib/member/report";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/me/report?period&from&to: the statement preview (same data as the PDF). */
export async function GET(req: NextRequest) {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const report = await reportFor(
    auth.current.user,
    req.nextUrl.searchParams,
    nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
  );
  if (!report) return apiError("VALIDATION_FAILED", "Check the period, from and to parameters.", 422);
  return NextResponse.json(report);
}
