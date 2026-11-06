import type { DateTime } from "luxon";
import { isDemoMode } from "@/lib/env";
import { demoStartInstant, now } from "./clock";

/**
 * "Now" for server-rendered screens. In demo mode the world is anchored on Friday
 * 6 November 2026 (same rule as the browser's demo clock); otherwise the real time.
 * Security decisions (session expiry, lockouts) always use real time.
 */
export function serverNow(): DateTime {
  return isDemoMode() ? demoStartInstant(now()) : now();
}
