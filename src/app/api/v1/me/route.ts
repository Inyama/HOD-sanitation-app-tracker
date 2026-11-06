import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { parseJson } from "@/lib/http";
import { profilePatch } from "@/lib/validation/member";
import type { User } from "@/lib/repo/types";

/** The fields of my own account the browser may see (never the password hash or 2FA secret). */
function me(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    adminLevel: u.adminLevel,
    status: u.status,
    isRemote: u.isRemote,
    country: u.country,
    city: u.city,
    timezone: u.timezone,
    language: u.language,
    avatarUrl: u.avatarUrl,
    approvedAt: u.approvedAt,
    notifPrefs: u.notifPrefs,
    deletionRequestedAt: u.deletionRequestedAt,
  };
}

/** GET /api/v1/me */
export async function GET() {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  return NextResponse.json(me(auth.current.user));
}

/** PATCH /api/v1/me: name, phone, city, country, time zone, language, photo. */
export async function PATCH(req: NextRequest) {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, profilePatch);
  if (!body.ok) return body.res;
  const updated = await repo().users.update(auth.current.user.id, body.data);
  return NextResponse.json(me(updated));
}
