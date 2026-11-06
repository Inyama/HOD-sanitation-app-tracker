import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { repo } from "@/lib/repo";
import { apiError } from "@/lib/http";
import { nowMs } from "@/lib/time/clock";

/**
 * GET /api/v1/meetings?upcoming=true
 * Public schedule fields only (title, type, time, status, venue address), used by the landing
 * page countdown. Attendance data is never exposed here.
 */
export async function GET(req: NextRequest) {
  const upcoming = req.nextUrl.searchParams.get("upcoming") === "true";
  if (!upcoming) return apiError("BAD_REQUEST", "Only ?upcoming=true is available without signing in.", 400);
  const r = repo();
  const [meetings, venues] = await Promise.all([r.meetings.list({ orderBy: { field: "startsAt" } }), r.venues.list()]);
  // Include the last week too, so a client on the simulated demo clock can pick the right "next" meeting.
  const from = DateTime.fromMillis(nowMs()).minus({ days: 7 }).toISO()!;
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
