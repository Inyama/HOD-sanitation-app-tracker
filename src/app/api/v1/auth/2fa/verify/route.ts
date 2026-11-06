import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/repo";
import { verifyTwoFactor } from "@/lib/auth/service";
import { sessionCookie } from "@/lib/auth/session";
import { TWO_FACTOR_COOKIE } from "@/lib/auth/claims";
import { twoFactorBody } from "@/lib/validation/auth";
import { deviceCookie, failureResponse, parseJson, requestContext, setCookie } from "@/lib/http";

const body = twoFactorBody.extend({ next: z.string().max(300).optional() });

/** POST /api/v1/auth/2fa/verify: the admin's six-digit code completes sign-in. */
export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, body);
  if (!parsed.ok) return parsed.res;
  const result = await verifyTwoFactor(
    repo(),
    req.cookies.get(TWO_FACTOR_COOKIE)?.value,
    parsed.data.code,
    parsed.data.next ?? null,
    requestContext(req),
  );
  if (!result.ok) return failureResponse(result);
  const res = NextResponse.json({ ok: true, next: result.next });
  setCookie(res, await sessionCookie(result.claims));
  setCookie(res, deviceCookie(result.deviceId));
  res.cookies.delete(TWO_FACTOR_COOKIE);
  return res;
}
