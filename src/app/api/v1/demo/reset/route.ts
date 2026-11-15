import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { repo } from "@/lib/repo";
import { resetAuthStore } from "@/lib/auth/store";
import { apiError } from "@/lib/http";
import { resetSchedulerState } from "@/lib/notifications/runner";

/** POST /api/v1/demo/reset: restore the deterministic seed and clear lockouts and the outbox (demo only). */
export async function POST() {
  if (!isDemoMode()) return apiError("NOT_FOUND", "Not available outside demo mode.", 404);
  await repo().reset();
  resetAuthStore();
  resetSchedulerState();
  return NextResponse.json({ ok: true });
}
