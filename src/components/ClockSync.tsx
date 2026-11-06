"use client";

import { useEffect } from "react";
import {
  CLOCK_COOKIE,
  clockState,
  decodeClockState,
  encodeClockState,
  restoreClock,
  subscribeClock,
} from "@/lib/time/clock";
import { isDemoMode } from "@/lib/env";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Demo mode: keeps a simulated clock across page loads and shares it with the server through
 * the hod_clock cookie, so check-in windows are judged at the same simulated moment.
 */
export function ClockSync() {
  useEffect(() => {
    if (!isDemoMode()) return;
    const saved = decodeClockState(readCookie(CLOCK_COOKIE));
    if (saved && saved.kind !== "real") restoreClock(saved);
    return subscribeClock(() => {
      const state = clockState();
      document.cookie =
        state.kind === "real"
          ? `${CLOCK_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
          : `${CLOCK_COOKIE}=${encodeClockState(state)}; Path=/; Max-Age=86400; SameSite=Lax`;
    });
  }, []);
  return null;
}
