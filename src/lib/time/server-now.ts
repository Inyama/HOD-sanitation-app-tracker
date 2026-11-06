import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { DateTime } from "luxon";
import { isDemoMode } from "@/lib/env";
import { CLOCK_COOKIE, decodeClockState, nowFromState } from "./clock";

/**
 * "Now" for a server request. Real time, except in demo mode where the browser's
 * "Simulate time" choice (saved in the hod_clock cookie) is honoured so check-in windows,
 * reminders and countdowns agree everywhere (spec 10.5). Outside demo mode the server never
 * trusts a client-supplied time (spec 6.2).
 */
export async function serverNow(): Promise<DateTime> {
  await connection();
  const real = Date.now();
  if (!isDemoMode()) return DateTime.fromMillis(real, { zone: "utc" });
  const state = decodeClockState((await cookies()).get(CLOCK_COOKIE)?.value);
  return DateTime.fromMillis(state ? nowFromState(state, real) : real, { zone: "utc" });
}

/** Same, for route handlers that already have the cookie value. */
export function nowForRequest(cookieValue: string | undefined): DateTime {
  const real = Date.now();
  const state = isDemoMode() ? decodeClockState(cookieValue) : null;
  return DateTime.fromMillis(state ? nowFromState(state, real) : real, { zone: "utc" });
}
