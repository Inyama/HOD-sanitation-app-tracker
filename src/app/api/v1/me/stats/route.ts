import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiUser } from "@/lib/auth/api";
import { loadMemberData } from "@/lib/member/data";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/me/stats: the five standard views, streaks and the next meeting. */
export async function GET() {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const now = nowForRequest((await cookies()).get(CLOCK_COOKIE)?.value);
  const d = await loadMemberData(auth.current.user, now);
  return NextResponse.json({
    views: d.views,
    currentStreak: d.currentStreak,
    longestStreak: d.longestStreak,
    next: d.next ? { id: d.next.id, title: d.next.title, startsAt: d.next.startsAt } : null,
  });
}
