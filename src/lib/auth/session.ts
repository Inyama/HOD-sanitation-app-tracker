import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { User, TitleCode } from "@/lib/repo/types";
import { repo } from "@/lib/repo";
import { nowMs } from "@/lib/time/clock";
import { authSecret } from "./secret";
import { signToken, verifyToken } from "./tokens";
import { canAccessPath, capabilities, type Actor, type Capability } from "./permissions";
import { SESSION_COOKIE, sessionState, type SessionClaims } from "./claims";

/** Server-side session access (the Data Access Layer for "who is signed in"). */

export interface CurrentUser {
  user: User;
  titles: TitleCode[];
  actor: Actor;
}

export async function readSessionClaims(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // Session checks compare against the current time, so they must run at request time
  // (not during a runtime prefetch prerender, where clock reads are not allowed).
  await connection();
  const claims = await verifyToken<SessionClaims>(token, authSecret(), "session", nowMs());
  if (!claims || sessionState(claims, nowMs()) !== "valid") return null;
  return claims;
}

export function actorFor(user: User, titles: TitleCode[]): Actor {
  return { role: user.role, adminLevel: user.adminLevel, status: user.status, titles };
}

/** The signed-in, active person with fresh data from the repository, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const claims = await readSessionClaims();
  if (!claims) return null;
  const user = await repo().users.get(claims.sub);
  if (!user || user.status !== "ACTIVE") return null;
  const titles = (await repo().userTitles.list({ where: { userId: user.id } })).map((t) => t.title);
  return { user, titles, actor: actorFor(user, titles) };
}

/**
 * Authoritative page guard: signed in, active, and allowed to open `path` under the
 * permission matrix. Call it at the top of every protected page.
 */
export async function requirePage(path: string): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!canAccessPath(current.actor, path)) redirect(`/forbidden?path=${encodeURIComponent(path)}`);
  return current;
}

/** Guard for route handlers: returns the user or null (the handler answers 401 or 403). */
export async function userWith(cap: Capability): Promise<{ current: CurrentUser | null; allowed: boolean }> {
  const current = await getCurrentUser();
  return { current, allowed: !!current && capabilities(current.actor).has(cap) };
}

export interface CookieSpec {
  name: string;
  value: string;
  options: { httpOnly: boolean; sameSite: "lax" | "strict"; secure: boolean; path: string; maxAge?: number };
}

export async function sessionCookie(claims: SessionClaims): Promise<CookieSpec> {
  return {
    name: SESSION_COOKIE,
    value: await signToken(claims, authSecret()),
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: claims.rem ? Math.floor((claims.exp - nowMs()) / 1000) : undefined,
    },
  };
}
