import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { rollbackUpload } from "@/lib/admin/ops-uploads";

/** POST /api/v1/admin/uploads/:id/rollback: remove the records a confirmed upload wrote (or discard a preview). */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/uploads/[id]/rollback">) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  return respond(await rollbackUpload(repo(), auth.ctx, id));
}
