import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { dutySignUp } from "@/lib/validation/volunteer";
import { buildDutyBoard } from "@/lib/volunteer/duties";
import { signUpForDuty, upcomingSaturdays } from "@/lib/volunteer/service";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/duties: the duty board for the next two Saturdays. */
export async function GET(req: NextRequest) {
  const auth = await apiUser("volunteer.duties");
  if (!auth.ok) return auth.res;
  const r = repo();
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const [meetings, zones, duties] = await Promise.all([upcomingSaturdays(r, now), r.zones.list(), r.duties.list()]);
  return NextResponse.json({
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt,
      board: buildDutyBoard(zones, duties, m.id, auth.current.user.id),
    })),
  });
}

/** POST /api/v1/duties: sign up for a zone. */
export async function POST(req: NextRequest) {
  const auth = await apiUser("volunteer.duties");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, dutySignUp);
  if (!body.ok) return body.res;
  const result = await signUpForDuty(
    repo(),
    auth.current.user,
    body.data.meetingId,
    body.data.zoneId,
    nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
  );
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return NextResponse.json(result, { status: 201 });
}
