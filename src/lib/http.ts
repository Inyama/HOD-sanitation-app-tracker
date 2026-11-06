import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import type { CookieSpec } from "@/lib/auth/session";
import { DEVICE_COOKIE } from "@/lib/auth/claims";
import type { Failure, RequestContext } from "@/lib/auth/service";

/** Helpers for /api/v1 route handlers: errors are always { error: { code, message } } (spec 11). */

export function apiError(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: { code, message, ...extra } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

const STATUS: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  INVALID_CODE: 401,
  PENDING_APPROVAL: 403,
  EMAIL_NOT_VERIFIED: 403,
  SUSPENDED: 403,
  REJECTED: 403,
  WRONG_TAB: 403,
  LOCKED: 423,
  RATE_LIMITED: 429,
  INVALID_TOKEN: 400,
  EXPIRED: 410,
  ALREADY_USED: 410,
  EMAIL_IN_USE: 409,
};

export function failureResponse(f: Failure) {
  const res = apiError(
    f.code,
    f.message,
    STATUS[f.code] ?? 400,
    f.retryAfterMs ? { retryAfterSeconds: Math.ceil(f.retryAfterMs / 1000) } : undefined,
  );
  if (f.retryAfterMs) res.headers.set("Retry-After", String(Math.ceil(f.retryAfterMs / 1000)));
  return res;
}

export async function parseJson<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; res: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: apiError("BAD_REQUEST", "The request body must be JSON.", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join(".") || "_", i.message]));
    return { ok: false, res: apiError("VALIDATION_FAILED", "Some fields need attention.", 422, { fields }) };
  }
  return { ok: true, data: parsed.data };
}

export function requestContext(req: NextRequest): RequestContext {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: fwd || req.headers.get("x-real-ip") || "local",
    deviceId: req.cookies.get(DEVICE_COOKIE)?.value ?? null,
    userAgent: req.headers.get("user-agent"),
  };
}

export function setCookie(res: NextResponse, c: CookieSpec) {
  res.cookies.set(c.name, c.value, c.options);
}

export function deviceCookie(deviceId: string): CookieSpec {
  return {
    name: DEVICE_COOKIE,
    value: deviceId,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 400 * 24 * 60 * 60,
    },
  };
}
