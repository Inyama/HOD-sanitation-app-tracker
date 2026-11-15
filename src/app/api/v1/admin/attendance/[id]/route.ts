import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { correctRecord } from "@/lib/admin/ops-corrections";
import { parseJson } from "@/lib/http";
import { correctionBody } from "@/lib/validation/ops";

/** PATCH /api/v1/admin/attendance/:id: change a record; a reason is required and the audit keeps before and after. */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/attendance/[id]">) {
  const auth = await adminRequest(req, "attendance.correct");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, correctionBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  return respond(await correctRecord(repo(), auth.ctx, id, body.data));
}
