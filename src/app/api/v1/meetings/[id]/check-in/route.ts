import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { performCheckIn } from "@/lib/attendance/checkin-service";
import { checkInBody } from "@/lib/validation/schemas";
import { apiError, parseJson } from "@/lib/http";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

const STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  REMOTE_MEMBER: 403,
  NOT_ELIGIBLE: 403,
  ALREADY_CHECKED_IN: 409,
};

/**
 * POST /api/v1/meetings/:id/check-in
 * Body: latitude, longitude, accuracy, deviceId, optional qrToken. The server decides the time
 * and status with its own clock (spec 6.2); in demo mode it honours the Simulate-time cookie.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("checkin.self");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, checkInBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const result = await performCheckIn(repo(), auth.current.user, id, body.data, now);
  if (!result.ok) {
    return apiError(
      result.code,
      result.message,
      STATUS[result.code] ?? 422,
      result.distanceM !== undefined ? { distanceM: result.distanceM } : undefined,
    );
  }
  return NextResponse.json(result, { status: 201 });
}
