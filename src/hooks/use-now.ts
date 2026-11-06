"use client";

import { useEffect, useState } from "react";
import type { DateTime } from "luxon";
import { now, subscribeClock } from "@/lib/time/clock";

/**
 * Re-renders every `intervalMs` with the simulated clock's current time.
 * Returns null until mounted so server and client markup match.
 */
export function useNow(intervalMs = 1000): DateTime | null {
  const [value, setValue] = useState<DateTime | null>(null);
  useEffect(() => {
    const tick = () => setValue(now());
    tick();
    const id = window.setInterval(tick, intervalMs);
    const unsubscribe = subscribeClock(tick);
    return () => {
      window.clearInterval(id);
      unsubscribe();
    };
  }, [intervalMs]);
  return value;
}
