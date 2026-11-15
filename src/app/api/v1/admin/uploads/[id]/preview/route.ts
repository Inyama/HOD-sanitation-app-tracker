import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest } from "@/lib/admin/api";
import { previewDetails } from "@/lib/admin/ops-uploads";
import { apiError } from "@/lib/http";

/** GET /api/v1/admin/uploads/:id/preview: rows by match type, decisions and what confirming will do. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/v1/admin/uploads/[id]/preview">) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const details = await previewDetails(repo(), id);
  if (!details) return apiError("NOT_FOUND", "Upload not found.", 404);
  return NextResponse.json({ ok: true, ...details }, { headers: { "Cache-Control": "no-store" } });
}
