import "server-only";
import type { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { capabilities, type Capability } from "./permissions";
import { getCurrentUser, type CurrentUser } from "./session";

/** Route-handler guard: 401 when signed out, 403 without the capability (spec 4.2, 11). */
export async function apiUser(
  cap: Capability,
): Promise<{ ok: true; current: CurrentUser } | { ok: false; res: NextResponse }> {
  const current = await getCurrentUser();
  if (!current) return { ok: false, res: apiError("UNAUTHENTICATED", "Please sign in.", 401) };
  if (!capabilities(current.actor).has(cap))
    return { ok: false, res: apiError("FORBIDDEN", "Your account cannot do this.", 403) };
  return { ok: true, current };
}
