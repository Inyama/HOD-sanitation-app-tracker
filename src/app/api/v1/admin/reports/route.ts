import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf } from "@/lib/admin/api";
import { generateReport, reportFile } from "@/lib/admin/ops-reports";
import { apiError } from "@/lib/http";
import { reportQuery } from "@/lib/validation/ops";

/**
 * GET /api/v1/admin/reports?type&range&meetingType&teamId&userId&format
 * format=json previews the report; csv, xlsx and pdf download a file generated from the live records.
 */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "reports.download");
  if (!auth.ok) return auth.res;
  const q = reportQuery.safeParse(queryOf(req));
  if (!q.success) return apiError("VALIDATION_FAILED", "Check the report type, period and format.", 422);
  const { type, range, meetingType, teamId, userId, format } = q.data;
  const filters = { meetingType, teamId: teamId || "ALL", userId: userId || null };
  if (format === "json") {
    const report = await generateReport(repo(), auth.ctx.now, type, range, filters);
    return NextResponse.json({ ok: true, report }, { headers: { "Cache-Control": "no-store" } });
  }
  const file = await reportFile(repo(), auth.ctx, type, range, filters, format);
  return new Response(typeof file.body === "string" ? file.body : new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
