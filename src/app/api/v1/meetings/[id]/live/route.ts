import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { findMeeting } from "@/lib/attendance/checkin-service";
import { liveLists } from "@/lib/volunteer/marshal";
import { windowPhase } from "@/lib/attendance/status";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/meetings/:id/live: present, late and expected lists for marshals (spec 7.3). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("marshal.tools");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const r = repo();
  const meeting = await findMeeting(r, id, now);
  if (!meeting) return apiError("NOT_FOUND", "Meeting not found.", 404);
  const [users, records] = await Promise.all([r.users.list(), r.records.list({ where: { meetingId: meeting.id } })]);
  const lists = liveLists(meeting, users, records);
  const phase = windowPhase(now, DateTime.fromISO(meeting.startsAt, { zone: "utc" }), {
    graceMinutes: meeting.graceMinutes,
    openBeforeMinutes: meeting.openBeforeMin,
    closeAfterMinutes: meeting.closeAfterMin,
  });
  return NextResponse.json(
    {
      meeting: { id: meeting.id, title: meeting.title, startsAt: meeting.startsAt, requireQr: meeting.requireQr },
      phase,
      at: now.toISO(),
      ...lists,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
