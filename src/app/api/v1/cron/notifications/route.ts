import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { DateTime } from "luxon";
import { repo } from "@/lib/repo";
import { apiError } from "@/lib/http";
import { runScheduler } from "@/lib/notifications/runner";

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/v1/cron/notifications: the every-minute scheduler run (spec 11), protected by
 * CRON_SECRET in an "Authorization: Bearer" header. Always uses the real server time.
 */
export async function POST(req: NextRequest) {
  if (!authorised(req)) return apiError("UNAUTHORIZED", "A valid cron secret is required.", 401);
  const summary = await runScheduler(repo(), DateTime.utc(), "cron");
  return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
}
