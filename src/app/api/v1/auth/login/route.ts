import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { signIn } from "@/lib/auth/service";
import { sessionCookie } from "@/lib/auth/session";
import { signToken } from "@/lib/auth/tokens";
import { authSecret } from "@/lib/auth/secret";
import { TWO_FACTOR_COOKIE, TWO_FACTOR_TTL_MS } from "@/lib/auth/claims";
import { loginBody } from "@/lib/validation/auth";
import { deviceCookie, failureResponse, parseJson, requestContext, setCookie } from "@/lib/http";

/** POST /api/v1/auth/login: email + password. Admins continue to the two-factor step. */
export async function POST(req: NextRequest) {
  const body = await parseJson(req, loginBody);
  if (!body.ok) return body.res;
  const result = await signIn(repo(), body.data, requestContext(req));
  if (!result.ok) return failureResponse(result);

  if (result.kind === "TWO_FACTOR") {
    const res = NextResponse.json({ ok: true, requiresTwoFactor: true });
    res.cookies.set(TWO_FACTOR_COOKIE, await signToken(result.pending, authSecret()), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TWO_FACTOR_TTL_MS / 1000,
    });
    return res;
  }
  const res = NextResponse.json({ ok: true, next: result.next });
  setCookie(res, await sessionCookie(result.claims));
  setCookie(res, deviceCookie(result.deviceId));
  return res;
}
