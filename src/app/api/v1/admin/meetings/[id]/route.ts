import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { cancelMeeting, editMeeting, rescheduleMeeting } from "@/lib/admin/ops-meetings";
import { parseJson } from "@/lib/http";
import { meetingActionBody } from "@/lib/validation/ops";

/**
 * PATCH /api/v1/admin/meetings/:id with { action }: "edit" (details), "cancel" or "reschedule".
 * Cancelling and rescheduling notify people; reminders follow the meeting automatically.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/meetings/[id]">) {
  const auth = await adminRequest(req, "meetings.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, meetingActionBody);
  if (!body.ok) return body.res;
  const { id } = await params;
  const r = repo();
  const b = body.data;
  if (b.action === "cancel") return respond(await cancelMeeting(r, auth.ctx, id, b.reason));
  if (b.action === "reschedule") return respond(await rescheduleMeeting(r, auth.ctx, id, b));
  return respond(await editMeeting(r, auth.ctx, id, b.changes));
}
