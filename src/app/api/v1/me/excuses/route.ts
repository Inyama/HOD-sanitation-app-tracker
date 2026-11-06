import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { excuseCreate } from "@/lib/validation/member";
import { canSubmitExcuse } from "@/lib/attendance/excuses";
import { findMeeting } from "@/lib/attendance/checkin-service";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/me/excuses: my excuse requests, newest first. */
export async function GET() {
  const auth = await apiUser("excuse.submit");
  if (!auth.ok) return auth.res;
  const items = await repo().excuses.list({
    where: { userId: auth.current.user.id },
    orderBy: { field: "createdAt", dir: "desc" },
  });
  return NextResponse.json({ items });
}

/** POST /api/v1/me/excuses: reason and optional proof, from 7 days before to 7 days after a meeting (spec 6.6). */
export async function POST(req: NextRequest) {
  const auth = await apiUser("excuse.submit");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, excuseCreate);
  if (!body.ok) return body.res;
  const { user } = auth.current;
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const r = repo();
  const meeting = await findMeeting(r, body.data.meetingId, now);
  if (!meeting) return apiError("NOT_FOUND", "Meeting not found.", 404);
  if (meeting.status === "CANCELLED")
    return apiError("MEETING_CANCELLED", "This meeting was cancelled, so no excuse is needed.", 422);
  if (user.isRemote && meeting.type === "SATURDAY")
    return apiError("NOT_NEEDED", "Remote members do not need an excuse for Saturday meetings.", 422);
  if (!user.approvedAt || DateTime.fromISO(meeting.startsAt) < DateTime.fromISO(user.approvedAt)) {
    return apiError("NOT_ELIGIBLE", "This meeting was before you joined the unit.", 422);
  }
  const window = canSubmitExcuse(now, meeting.startsAt);
  if (!window.ok) {
    return apiError(
      window.reason,
      window.reason === "TOO_EARLY"
        ? "You can ask for an excuse from 7 days before the meeting."
        : "Excuses must be sent within 7 days after the meeting.",
      422,
    );
  }
  const record = await r.records.findFirst({ meetingId: meeting.id, userId: user.id });
  if (record && (record.status === "ON_TIME" || record.status === "LATE")) {
    return apiError("ALREADY_ATTENDED", "You attended this meeting, so no excuse is needed.", 422);
  }
  const open = (await r.excuses.list({ where: { userId: user.id, meetingId: meeting.id } })).find(
    (e) => e.status !== "DECLINED",
  );
  if (open)
    return apiError("DUPLICATE", `You already have a ${open.status.toLowerCase()} request for this meeting.`, 409);
  if (body.data.proofUrl) {
    const fileId = body.data.proofUrl.split("/").pop()!;
    const { authStore } = await import("@/lib/auth/store");
    if (authStore().files.get(fileId)?.ownerId !== user.id)
      return apiError("BAD_PROOF", "Upload the proof again.", 422);
  }
  const created = await r.excuses.create({
    userId: user.id,
    meetingId: meeting.id,
    reason: body.data.reason,
    proofUrl: body.data.proofUrl ?? null,
    status: "PENDING",
    reviewedById: null,
    reviewNote: null,
    createdAt: now.toISO()!,
  });
  return NextResponse.json({ ok: true, excuse: created }, { status: 201 });
}
