import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest } from "@/lib/admin/api";
import { uploadOriginal } from "@/lib/admin/ops-uploads";
import { apiError } from "@/lib/http";

/** GET /api/v1/admin/uploads/:id/file: the original file of an upload. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/v1/admin/uploads/[id]/file">) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const file = await uploadOriginal(repo(), id);
  if (!file) return apiError("NOT_FOUND", "Upload not found.", 404);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${file.name.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
