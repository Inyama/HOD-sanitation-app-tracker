import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { authSecret } from "@/lib/auth/secret";
import { findMeeting } from "@/lib/attendance/checkin-service";
import { QR_STEP_MS, qrCodeFor } from "@/lib/attendance/qr";
import { appUrl } from "@/lib/notifications/senders";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/meetings/:id/qr: the current rotating check-in code for the marshal screen. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("marshal.tools");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const meeting = await findMeeting(repo(), id, now);
  if (!meeting) return apiError("NOT_FOUND", "Meeting not found.", 404);
  const ms = now.toMillis();
  const code = await qrCodeFor(meeting.id, ms, authSecret());
  const url = `${appUrl()}/member/check-in?code=${code}`;
  return NextResponse.json(
    { code, url, expiresInMs: QR_STEP_MS - (ms % QR_STEP_MS), requireQr: meeting.requireQr },
    { headers: { "Cache-Control": "no-store" } },
  );
}
