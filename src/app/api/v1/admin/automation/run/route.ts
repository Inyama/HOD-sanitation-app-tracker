import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest } from "@/lib/admin/api";
import { runScheduler } from "@/lib/notifications/runner";

/** POST /api/v1/admin/automation/run: run the scheduler now (what the every-minute cron does). */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "automation.manage");
  if (!auth.ok) return auth.res;
  const summary = await runScheduler(repo(), auth.ctx.now, "admin");
  return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
}
