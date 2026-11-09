import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { manualCheckInBody } from "@/lib/validation/volunteer";
import { manualCheckIn } from "@/lib/volunteer/service";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** POST /api/v1/meetings/:id/manual-check-in: a marshal records someone by hand (flagged for review). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("marshal.tools");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, manualCheckInBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  const result = await manualCheckIn(
    repo(),
    auth.current.user,
    id,
    body.data.userId,
    body.data.note,
    nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
  );
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return NextResponse.json(result, { status: 201 });
}
