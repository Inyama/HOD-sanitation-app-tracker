import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { isDemoMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { runScheduler } from "@/lib/notifications/runner";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/**
 * POST /api/v1/demo/tick (demo only): run the scheduler at the browser's simulated time, so
 * reminders appear in the notification center as "Simulate time" moves the clock. In the live
 * app the cron route does this every minute instead.
 */
export async function POST(req: NextRequest) {
  if (!isDemoMode()) return apiError("NOT_FOUND", "Not available outside demo mode.", 404);
  const current = await getCurrentUser();
  if (!current) return apiError("UNAUTHENTICATED", "Please sign in.", 401);
  const summary = await runScheduler(repo(), nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value), "demo");
  return NextResponse.json(
    { ok: true, forMe: summary.createdFor.includes(current.user.id), at: summary.to },
    { headers: { "Cache-Control": "no-store" } },
  );
}
