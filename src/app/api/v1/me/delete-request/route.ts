import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { now } from "@/lib/time/clock";

/**
 * POST /api/v1/me/delete-request: ask for my account to be deleted (spec 12). An admin confirms
 * it within 30 days; DELETE cancels the request.
 */
export async function POST() {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const u = auth.current.user;
  const at = u.deletionRequestedAt ?? now().toISO()!;
  await repo().users.update(u.id, { deletionRequestedAt: at });
  await repo().audit.append({
    actorId: u.id,
    action: "DELETION_REQUESTED",
    entity: "User",
    entityId: u.id,
    before: null,
    after: { deletionRequestedAt: at },
    ip: null,
  });
  return NextResponse.json({ ok: true, deletionRequestedAt: at });
}

export async function DELETE() {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const u = auth.current.user;
  await repo().users.update(u.id, { deletionRequestedAt: null });
  await repo().audit.append({
    actorId: u.id,
    action: "DELETION_CANCELLED",
    entity: "User",
    entityId: u.id,
    before: null,
    after: null,
    ip: null,
  });
  return NextResponse.json({ ok: true, deletionRequestedAt: null });
}
