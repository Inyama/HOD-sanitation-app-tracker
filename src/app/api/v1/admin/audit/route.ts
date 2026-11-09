import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf } from "@/lib/admin/api";
import { auditCsv, filterAudit } from "@/lib/admin/audit";
import { nameDirectory } from "@/lib/admin/data";
import { paginate } from "@/lib/admin/members";
import { apiError } from "@/lib/http";
import { auditQuery } from "@/lib/validation/admin";

/** GET /api/v1/admin/audit: filtered audit log as JSON pages, or ?format=csv to export. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "audit.view");
  if (!auth.ok) return auth.res;
  const parsed = auditQuery.safeParse(queryOf(req));
  if (!parsed.success) return apiError("BAD_REQUEST", "Some filters are not valid.", 400);
  const { format, page, pageSize, ...filters } = parsed.data;
  const r = repo();
  const [rows, names] = await Promise.all([r.audit.list(), nameDirectory(r)]);
  const filtered = filterAudit(rows, filters, names);
  if (format === "csv") {
    await r.audit.append({
      actorId: auth.ctx.admin.id,
      action: "AUDIT_EXPORTED",
      entity: "AuditLog",
      entityId: null,
      before: null,
      after: { rows: filtered.length, filters },
      ip: auth.ctx.ip,
      createdAt: auth.ctx.now.toISO()!,
    });
    const stamp = auth.ctx.now.setZone("Africa/Lagos").toFormat("yyyy-LL-dd");
    return new NextResponse(auditCsv(filtered, names), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hod-audit-log-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const p = paginate(filtered, page, pageSize ?? 50);
  return NextResponse.json(
    { ...p, items: p.items.map((a) => ({ ...a, actorName: a.actorId ? (names.get(a.actorId) ?? null) : null })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
