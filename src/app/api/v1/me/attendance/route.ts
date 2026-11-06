import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { loadMemberData } from "@/lib/member/data";
import { buildMemberReport, resolvePeriod } from "@/lib/reports/member-report";
import { methodLabel } from "@/lib/reports/member-report";
import { toCsv } from "@/lib/reports/csv";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

const query = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: z.enum(["SATURDAY", "THURSDAY_PRAYER", "SPECIAL"]).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

const STATUS_LABEL = { ON_TIME: "On time", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused" } as const;

/** GET /api/v1/me/attendance?from&to&type&format=csv: my history (CSV is "export my data"). */
export async function GET(req: NextRequest) {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const q = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return apiError("VALIDATION_FAILED", "Check the from, to, type and format parameters.", 422);
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const { user } = auth.current;
  const d = await loadMemberData(user, now);
  const period =
    q.data.from || q.data.to
      ? resolvePeriod("custom", now, { from: q.data.from, to: q.data.to })
      : resolvePeriod("all", now);
  const report = buildMemberReport({
    person: user,
    records: d.records,
    meetings: d.meetings,
    period,
    now,
    lateWeight: d.settings.lateWeight,
  });
  const rows = report.rows.filter((r) => !q.data.type || r.type === q.data.type);

  if (q.data.format === "csv") {
    const csv = toCsv(rows, [
      { header: "Date", value: (r) => r.date },
      { header: "Meeting", value: (r) => r.meeting },
      { header: "Status", value: (r) => STATUS_LABEL[r.status] },
      { header: "Check-in time (Lagos)", value: (r) => r.checkInTime ?? "" },
      { header: "Recorded by", value: (r) => methodLabel(r.method) },
    ]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="my-attendance-${now.toISODate()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ period: report.period, overall: report.overall, rows });
}
