import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { confirmUpload } from "@/lib/admin/ops-uploads";
import { parseJson } from "@/lib/http";
import { confirmUploadBody } from "@/lib/validation/ops";

/** POST /api/v1/admin/uploads/:id/confirm: write the records (replace: true replaces an earlier sheet). */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/uploads/[id]/confirm">) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, confirmUploadBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  return respond(await confirmUpload(repo(), auth.ctx, id, body.data.replace));
}
