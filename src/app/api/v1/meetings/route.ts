import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiError } from "@/lib/http";
import { now } from "@/lib/time/clock";
import { withRecurringMeetings } from "@/lib/time/schedule";

/**
 * GET /api/v1/meetings?upcoming=true
 * Public schedule fields only (title, type, time, status, venue address), used by the landing
 * page countdown. Attendance data is never exposed here.
 */
export async function GET(req: NextRequest) {
  const upcoming = req.nextUrl.searchParams.get("upcoming") === "true";
  if (!upcoming) return apiError("BAD_REQUEST", "Only ?upcoming=true is available without signing in.", 400);
  const r = repo();
  const [stored, venues] = await Promise.all([r.meetings.list({ orderBy: { field: "startsAt" } }), r.venues.list()]);
  const current = now();
  const meetings = withRecurringMeetings(stored, current);
  // Include the last week too, so a browser on a simulated clock can still pick the right "next" meeting.
  const from = current.minus({ days: 7 }).toISO()!;
  const venue = venues[0];
  const items = meetings
    .filter((m) => m.startsAt >= from)
    .slice(0, 12)
    .map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      startsAt: m.startsAt,
      status: m.status,
      closeAfterMin: m.closeAfterMin,
      method: m.method,
      statusNote: m.statusNote,
      venue: venue ? { name: venue.name, address: venue.address, lat: venue.lat, lng: venue.lng } : null,
    }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
