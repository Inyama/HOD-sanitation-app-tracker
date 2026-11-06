import type { NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { renderMemberReportPdf } from "@/lib/reports/pdf";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";
import { reportFor } from "@/lib/member/report";

/** GET /api/v1/me/report.pdf?period&from&to: my attendance statement as a PDF with the logo. */
export async function GET(req: NextRequest) {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const report = await reportFor(auth.current.user, req.nextUrl.searchParams, now);
  if (!report) return apiError("VALIDATION_FAILED", "Check the period, from and to parameters.", 422);
  const pdf = await renderMemberReportPdf(report);
  const name = auth.current.user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attendance-${name}-${now.toISODate()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
