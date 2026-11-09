"use client";

import { DateTime } from "luxon";
import { useNow } from "@/hooks/use-now";

/** Live "in 2 days, 4 hours" countdown text, driven by the app clock. */
export function RelativeTime({ iso }: { iso: string }) {
  const now = useNow(30_000);
  if (!now) return <span>&nbsp;</span>;
  const target = DateTime.fromISO(iso, { zone: "utc" });
  const diff = target.diff(now, ["days", "hours", "minutes"]);
  if (diff.toMillis() <= 0) return <span>Happening now or finished</span>;
  const d = Math.floor(diff.days);
  const h = Math.floor(diff.hours);
  const m = Math.floor(diff.minutes);
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return (
    <span>
      in{" "}
      {d > 0
        ? `${part(d, "day")}, ${part(h, "hour")}`
        : h > 0
          ? `${part(h, "hour")}, ${part(m, "minute")}`
          : part(m, "minute")}
    </span>
  );
}
