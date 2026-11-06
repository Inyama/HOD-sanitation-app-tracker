import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { rsvpBody } from "@/lib/validation/member";
import { findMeeting } from "@/lib/attendance/checkin-service";
import { now } from "@/lib/time/clock";

/** POST /api/v1/meetings/:id/rsvp: Going, Maybe or Can't make it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("events.view");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, rsvpBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  const meeting = await findMeeting(repo(), id, now());
  if (!meeting) return apiError("NOT_FOUND", "Meeting not found.", 404);
  const userId = auth.current.user.id;
  const existing = await repo().rsvps.findFirst({ meetingId: meeting.id, userId });
  const saved = existing
    ? await repo().rsvps.update(existing.id, { answer: body.data.answer })
    : await repo().rsvps.create({
        id: `rsvp-${meeting.id.slice(4)}-${userId.slice(4)}`,
        meetingId: meeting.id,
        userId,
        answer: body.data.answer,
      });
  return NextResponse.json({ ok: true, rsvp: saved });
}
