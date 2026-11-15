import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest } from "@/lib/admin/api";
import { deliveryReport } from "@/lib/admin/ops-messages";
import { apiError } from "@/lib/http";

/** GET /api/v1/admin/messages/:id/delivery: each recipient with delivered, read and email status. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/v1/admin/messages/[id]/delivery">) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const report = await deliveryReport(repo(), id);
  if (!report) return apiError("NOT_FOUND", "Message not found.", 404);
  return NextResponse.json({ ok: true, ...report }, { headers: { "Cache-Control": "no-store" } });
}
