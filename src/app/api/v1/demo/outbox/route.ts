import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/env";
import { authStore } from "@/lib/auth/store";
import { apiError } from "@/lib/http";

/** GET /api/v1/demo/outbox: emails "sent" by the console sender (demo mode only). */
export async function GET() {
  await connection();
  if (!isDemoMode()) return apiError("NOT_FOUND", "Not available outside demo mode.", 404);
  return NextResponse.json({ items: authStore().outbox }, { headers: { "Cache-Control": "no-store" } });
}
