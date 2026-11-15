import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest } from "@/lib/admin/api";
import { loadExcuseQueue } from "@/lib/admin/ops-excuses";

/** GET /api/v1/admin/excuses: pending requests (oldest first) and recent decisions. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "excuse.review");
  if (!auth.ok) return auth.res;
  const data = await loadExcuseQueue(repo(), auth.ctx.now);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}
