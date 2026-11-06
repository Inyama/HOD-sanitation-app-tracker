import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiError } from "@/lib/http";
import { meetingIcs } from "@/lib/reports/calendar";
import { appUrl } from "@/lib/notifications/senders";
import { findMeeting } from "@/lib/attendance/checkin-service";
import { now } from "@/lib/time/clock";

/** GET /api/v1/meetings/:id/calendar.ics: an .ics file for one meeting (spec 7.2 Add to calendar). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void req;
  const { id } = await params;
  const meeting = await findMeeting(repo(), id, now());
  if (!meeting) return apiError("NOT_FOUND", "Meeting not found.", 404);
  const venue = (await repo().venues.list())[0];
  const ics = meetingIcs(meeting, { address: venue?.address ?? "", appUrl: appUrl() });
  const file = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${meeting.startsAt.slice(0, 10)}.ics`;
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
