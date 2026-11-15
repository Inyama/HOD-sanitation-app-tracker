import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { materializeMeeting } from "@/lib/admin/ops-common";
import { closeMeeting } from "@/lib/attendance/close-service";
import { needsClosing } from "@/lib/attendance/close";
import { apiError } from "@/lib/http";

/** POST /api/v1/admin/meetings/:id/close: record absentees for a held location meeting that is not closed yet. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/meetings/[id]/close">) {
  const auth = await adminRequest(req, "attendance.correct");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const r = repo();
  const meeting = await materializeMeeting(r, id);
  if (!meeting) return apiError("NOT_FOUND", "Meeting not found.", 404);
  if (!needsClosing(meeting, auth.ctx.now))
    return apiError(
      "NOT_CLOSABLE",
      meeting.method === "SHEET"
        ? "Sheet meetings are closed by confirming their upload."
        : meeting.status === "CLOSED"
          ? "This meeting is already closed."
          : "Check-in for this meeting has not ended yet.",
      409,
    );
  const res = await closeMeeting(r, meeting, auth.ctx.now, auth.ctx.admin.id);
  return respond({ ok: true as const, ...res });
}
