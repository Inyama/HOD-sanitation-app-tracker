import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { resolveRow } from "@/lib/admin/ops-uploads";
import { parseJson } from "@/lib/http";
import { resolveRowBody } from "@/lib/validation/ops";

/** PATCH /api/v1/admin/uploads/:id/rows/:rowId: accept, ignore or assign one row (null clears). */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/uploads/[id]/rows/[rowId]">) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, resolveRowBody);
  if (!body.ok) return body.res;
  const { id, rowId } = await params;
  return respond(await resolveRow(repo(), auth.ctx, id, rowId, body.data.resolution));
}
