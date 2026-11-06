import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { repo } from "@/lib/repo";
import { isDemoMode } from "@/lib/env";
import { buildDemoSummary } from "@/lib/demo/summary";
import { SEED_NOW } from "@/data/seed";

/**
 * GET /api/v1/demo/summary?at=ISO
 * Demo-only review endpoint: seed totals, demo accounts and the business rules evaluated at a
 * simulated instant. Real endpoints never accept a client-supplied time (spec 6.2).
 */
export async function GET(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Not available outside demo mode." } },
      { status: 404 },
    );
  }
  const atParam = request.nextUrl.searchParams.get("at");
  const at = atParam ? DateTime.fromISO(atParam, { zone: "utc" }) : SEED_NOW;
  if (!at.isValid) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "`at` must be an ISO date-time." } },
      { status: 400 },
    );
  }
  const summary = await buildDemoSummary(repo(), at.toUTC());
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
