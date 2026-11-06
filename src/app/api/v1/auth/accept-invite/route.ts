import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { acceptInvite, startInvite } from "@/lib/auth/service";
import { sessionCookie } from "@/lib/auth/session";
import { acceptInviteBody } from "@/lib/validation/auth";
import { apiError, deviceCookie, failureResponse, parseJson, requestContext, setCookie } from "@/lib/http";

/** GET /api/v1/auth/accept-invite?token= returns the invite and a fresh two-factor secret to scan. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return apiError("INVALID_TOKEN", "Missing invitation token.", 400);
  const result = await startInvite(repo(), token);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/v1/auth/accept-invite: creates the admin account, turns on two-factor and signs in. */
export async function POST(req: NextRequest) {
  const body = await parseJson(req, acceptInviteBody);
  if (!body.ok) return body.res;
  const result = await acceptInvite(repo(), body.data, requestContext(req));
  if (!result.ok) return failureResponse(result);
  const res = NextResponse.json({ ok: true, next: result.next }, { status: 201 });
  setCookie(res, await sessionCookie(result.claims));
  setCookie(res, deviceCookie(result.deviceId));
  return res;
}
