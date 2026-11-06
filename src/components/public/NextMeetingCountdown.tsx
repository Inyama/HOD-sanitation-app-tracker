"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleAlert } from "lucide-react";
import { CountdownTiles } from "@/components/brand/CountdownHero";
import { useNow } from "@/hooks/use-now";
import { nextMeeting } from "@/lib/time/schedule";
import { formatShort, formatForViewer } from "@/lib/time/zone";

interface PublicMeeting {
  id: string;
  type: string;
  title: string;
  startsAt: string;
  status: string;
  closeAfterMin: number;
  statusNote: string | null;
}

/** Landing hero countdown: picks the next meeting on the (simulated) clock from the public schedule. */
export function NextMeetingCountdown() {
  const now = useNow(1000);
  const q = useQuery({
    queryKey: ["public-meetings"],
    queryFn: async () => {
      const res = await fetch("/api/v1/meetings?upcoming=true");
      if (!res.ok) throw new Error("schedule unavailable");
      return (await res.json()).items as PublicMeeting[];
    },
  });
  const next = q.data && now ? nextMeeting(q.data, now) : null;
  const viewerZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Africa/Lagos";

  return (
    <div
      className="bg-grad-glass w-full rounded-(--radius-xl) border border-white/15 p-5 shadow-lift backdrop-blur-md sm:p-6"
      aria-live="off"
    >
      <p className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">Next meeting</p>
      {q.isError ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-white/85">
          <CircleAlert aria-hidden className="size-4" /> The schedule could not be loaded. Saturdays 9:30 am, Thursdays
          8:30 pm.
        </p>
      ) : !next ? (
        <div className="mt-3 space-y-3" role="status">
          <span className="sr-only">Loading the next meeting</span>
          <div className="h-7 w-3/4 animate-pulse rounded bg-white/15" />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-(--radius-md) bg-white/10" />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-4">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{next.title}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-white/85">
              <CalendarDays aria-hidden className="size-4 shrink-0 text-gold-300" />
              {formatShort(next.startsAt)} (Lagos)
              {viewerZone !== "Africa/Lagos" && (
                <span className="text-white/70">
                  · your time {formatForViewer(next.startsAt, viewerZone).split(" (")[0]}
                </span>
              )}
            </p>
          </div>
          <CountdownTiles startsAt={next.startsAt} />
        </div>
      )}
    </div>
  );
}
