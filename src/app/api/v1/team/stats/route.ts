import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { teamStats } from "@/lib/volunteer/service";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/team/stats: my team (Team Leads) or all teams (admins). */
export async function GET(req: NextRequest) {
  const auth = await apiUser("team.view");
  if (!auth.ok) return auth.res;
  return NextResponse.json({
    teams: await teamStats(repo(), auth.current.user, nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value)),
  });
}
