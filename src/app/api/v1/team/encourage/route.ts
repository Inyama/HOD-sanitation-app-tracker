import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { encourageBody } from "@/lib/validation/volunteer";
import { sendEncouragement } from "@/lib/volunteer/service";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** POST /api/v1/team/encourage: one-tap encouragement to someone in my team. */
export async function POST(req: NextRequest) {
  const auth = await apiUser("team.view");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, encourageBody);
  if (!body.ok) return body.res;
  const result = await sendEncouragement(
    repo(),
    auth.current.user,
    body.data.userId,
    nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
  );
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return NextResponse.json(result, { status: 201 });
}
