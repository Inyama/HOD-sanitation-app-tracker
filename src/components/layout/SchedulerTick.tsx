"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { subscribeClock } from "@/lib/time/clock";

const EVERY_MS = 30_000;

/**
 * Demo mode only: asks the server to run the notification scheduler at the simulated time
 * (every 30 seconds, when the tab regains focus, and right after "Simulate time" moves the clock),
 * then refreshes the page when something new arrived for this person, so the bell updates.
 * In the live app the cron route runs the scheduler every minute instead.
 */
export function SchedulerTick() {
  const router = useRouter();
  useEffect(() => {
    if (!isDemoMode()) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch("/api/v1/demo/tick", { method: "POST", credentials: "same-origin" });
        if (!stopped && res.ok && ((await res.json()) as { forMe?: boolean }).forMe) router.refresh();
      } catch {
        /* offline: try again next time */
      }
    };
    void tick();
    const interval = setInterval(tick, EVERY_MS);
    const onFocus = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onFocus);
    // ClockSync writes the clock cookie on the same change; run just after it.
    const unsubscribe = subscribeClock(() => {
      clearTimeout(timer);
      timer = setTimeout(tick, 150);
    });
    return () => {
      stopped = true;
      clearInterval(interval);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onFocus);
      unsubscribe();
    };
  }, [router]);
  return null;
}
