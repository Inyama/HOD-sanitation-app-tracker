import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { deleteAnnouncement, updateAnnouncement } from "@/lib/admin/ops-messages";
import { parseJson } from "@/lib/http";
import { announcementPatch } from "@/lib/validation/comms";

/** PATCH /api/v1/admin/announcements/:id: edit, pin or unpin. */
export async function PATCH(req: NextRequest, { params }: RouteContext<"/api/v1/admin/announcements/[id]">) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, announcementPatch);
  if (!body.ok) return body.res;
  const { id } = await params;
  return respond(await updateAnnouncement(repo(), auth.ctx, id, body.data));
}

/** DELETE /api/v1/admin/announcements/:id */
export async function DELETE(req: NextRequest, { params }: RouteContext<"/api/v1/admin/announcements/[id]">) {
  const auth = await adminRequest(req, "messages.send");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  return respond(await deleteAnnouncement(repo(), auth.ctx, id));
}
