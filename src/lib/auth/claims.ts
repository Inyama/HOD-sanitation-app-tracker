import type { AdminLevel, Role, TitleCode } from "@/lib/repo/types";

/**
 * Session rules (spec 4.3). Pure, so the proxy, route handlers and tests share them.
 * - Members and volunteers: sessions last 30 days.
 * - Admins: sessions end after 8 hours without activity.
 * The cookie carries role claims for fast, optimistic area checks in the proxy; every page
 * and route still re-checks the person's current permissions on the server.
 */

export const SESSION_COOKIE = "hod_session";
export const TWO_FACTOR_COOKIE = "hod_2fa";
export const DEVICE_COOKIE = "hod_device";

export const MEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const ADMIN_IDLE_MS = 8 * 60 * 60 * 1000;
export const ADMIN_SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;
export const TWO_FACTOR_TTL_MS = 10 * 60 * 1000;
/** Refresh an admin's activity stamp at most this often (keeps cookie writes rare). */
export const ACTIVITY_REFRESH_MS = 5 * 60 * 1000;

export interface SessionClaims {
  typ: "session";
  sub: string;
  role: Role;
  lvl: AdminLevel | null;
  ttl: TitleCode[];
  iat: number;
  exp: number;
  /** Last activity (admins only matter). */
  act: number;
  /** "Remember this device": persistent cookie instead of a browser-session cookie. */
  rem: boolean;
}

export interface TwoFactorClaims {
  typ: "2fa";
  sub: string;
  exp: number;
  rem: boolean;
}

export function newSessionClaims(
  user: { id: string; role: Role; adminLevel: AdminLevel | null },
  titles: TitleCode[],
  remember: boolean,
  nowMs: number,
): SessionClaims {
  const life = user.role === "ADMIN" ? ADMIN_SESSION_MAX_MS : MEMBER_SESSION_MS;
  return {
    typ: "session",
    sub: user.id,
    role: user.role,
    lvl: user.adminLevel,
    ttl: titles,
    iat: nowMs,
    exp: nowMs + life,
    act: nowMs,
    rem: remember,
  };
}

export type SessionState = "valid" | "expired" | "idle";

export function sessionState(c: SessionClaims, nowMs: number): SessionState {
  if (c.exp <= nowMs) return "expired";
  if (c.role === "ADMIN" && nowMs - c.act > ADMIN_IDLE_MS) return "idle";
  return "valid";
}

export function shouldRefreshActivity(c: SessionClaims, nowMs: number): boolean {
  return c.role === "ADMIN" && nowMs - c.act > ACTIVITY_REFRESH_MS;
}

export type Area = "member" | "volunteer" | "admin";

export function areaOf(path: string): Area | null {
  for (const a of ["member", "volunteer", "admin"] as const) {
    if (path === `/${a}` || path.startsWith(`/${a}/`)) return a;
  }
  return null;
}

export function homeFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : role === "VOLUNTEER" ? "/volunteer" : "/member";
}

export type AreaDecision =
  { action: "allow" } | { action: "login"; reason: "signed-out" | "expired" | "idle" } | { action: "forbidden" };

/**
 * Optimistic proxy decision from the cookie alone: signed in, not expired or idle,
 * and the role fits the area. Title and admin-level rules are checked by the page itself.
 */
export function areaDecision(path: string, claims: SessionClaims | null, nowMs: number): AreaDecision {
  const area = areaOf(path);
  if (!area) return { action: "allow" };
  if (!claims) return { action: "login", reason: "signed-out" };
  const state = sessionState(claims, nowMs);
  if (state !== "valid") return { action: "login", reason: state };
  if (area === "volunteer" && claims.role !== "VOLUNTEER") return { action: "forbidden" };
  if (area === "admin" && claims.role !== "ADMIN") return { action: "forbidden" };
  return { action: "allow" };
}

/** Only allow same-site relative paths as a post-login destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
