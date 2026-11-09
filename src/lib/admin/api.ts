import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/api";
import type { Capability } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { apiError, requestContext } from "@/lib/http";
import { CLOCK_COOKIE } from "@/lib/time/clock";
import { nowForRequest } from "@/lib/time/server-now";
import type { AdminContext } from "./service";

/** Route-handler guard for /api/v1/admin: the capability check plus who, from where and when. */
export async function adminRequest(
  req: NextRequest,
  cap: Capability,
): Promise<{ ok: true; ctx: AdminContext; current: CurrentUser } | { ok: false; res: NextResponse }> {
  const auth = await apiUser(cap);
  if (!auth.ok) return auth;
  return {
    ok: true,
    current: auth.current,
    ctx: {
      admin: auth.current.user,
      ip: requestContext(req).ip,
      now: nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
    },
  };
}

/** Turn a service result into a response: failures keep their code, message and status. */
export function respond(
  result: { ok: true } | { ok: false; code: string; message: string; status: number },
  status = 200,
): NextResponse {
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
}

/** Query string to a plain object for Zod. */
export function queryOf(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
