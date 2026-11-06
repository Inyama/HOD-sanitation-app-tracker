import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, signToken } from "@/lib/auth/tokens";
import { authSecret } from "@/lib/auth/secret";
import {
  areaDecision,
  areaOf,
  homeFor,
  SESSION_COOKIE,
  sessionState,
  shouldRefreshActivity,
  type SessionClaims,
} from "@/lib/auth/claims";

/**
 * Optimistic route protection (spec 4.2, 4.3). From the signed session cookie alone it:
 * - sends signed-out, expired or idle visitors to /login (remembering where they were going);
 * - sends people to /forbidden when their role does not fit the area;
 * - keeps an admin's 8-hour inactivity timer sliding;
 * - sends signed-in people away from /login to their home.
 * Pages and route handlers still check the person's current permissions on the server.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const now = Date.now();
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = raw ? await verifyToken<SessionClaims>(raw, authSecret(), "session", now) : null;

  if (pathname === "/login") {
    if (claims && sessionState(claims, now) === "valid")
      return NextResponse.redirect(new URL(homeFor(claims.role), req.url));
    return NextResponse.next();
  }

  const decision = areaDecision(pathname, claims, now);
  if (decision.action === "login") {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    const area = areaOf(pathname);
    if (area) url.searchParams.set("tab", area);
    if (decision.reason !== "signed-out") url.searchParams.set("reason", decision.reason);
    const res = NextResponse.redirect(url);
    if (raw) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (decision.action === "forbidden") {
    const url = new URL("/forbidden", req.url);
    url.searchParams.set("path", pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (claims && shouldRefreshActivity(claims, now)) {
    const refreshed: SessionClaims = { ...claims, act: now };
    res.cookies.set(SESSION_COOKIE, await signToken(refreshed, authSecret()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: refreshed.rem ? Math.floor((refreshed.exp - now) / 1000) : undefined,
    });
  }
  return res;
}

export const config = {
  matcher: ["/member/:path*", "/volunteer/:path*", "/admin/:path*", "/login"],
};
