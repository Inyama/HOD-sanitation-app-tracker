import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { reviewFlag } from "@/lib/admin/ops-corrections";
import { parseJson } from "@/lib/http";
import { reviewFlagBody } from "@/lib/validation/ops";

/** POST /api/v1/admin/attendance/:id/review: clear a flag without changing the record. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/attendance/[id]/review">) {
  const auth = await adminRequest(req, "attendance.correct");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, reviewFlagBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  return respond(await reviewFlag(repo(), auth.ctx, id, body.data.note));
}
