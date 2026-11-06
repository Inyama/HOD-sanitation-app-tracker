"use client";

import { MapPin, CalendarDays } from "lucide-react";
import { DateTime } from "luxon";
import { useNow } from "@/hooks/use-now";
import { formatShort } from "@/lib/time/zone";
import { GradientBackdrop } from "./GradientBackdrop";
import { cn } from "@/lib/utils";

interface CountdownHeroProps {
  meetingName: string;
  /** ISO start time (UTC). */
  startsAt: string;
  venue: string;
  action?: React.ReactNode;
  /** Shown under the action, e.g. "Opens Saturday 8:30 am". */
  actionHint?: string;
  eyebrow?: string;
  className?: string;
}

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Spec 3.5: gradient hero with next meeting, live countdown, venue and primary action. */
export function CountdownHero({
  meetingName,
  startsAt,
  venue,
  action,
  actionHint,
  eyebrow = "Next meeting",
  className,
}: CountdownHeroProps) {
  return (
    <GradientBackdrop variant="hero" className={cn("rounded-(--radius-xl) text-white shadow-lift", className)}>
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">{eyebrow}</p>
          <h2 className="text-2xl font-semibold sm:text-3xl">{meetingName}</h2>
          <ul className="space-y-1.5 text-sm text-white/85">
            <li className="flex items-center gap-2">
              <CalendarDays aria-hidden className="size-4 shrink-0 text-gold-300" />
              <span>{formatShort(startsAt)} (Lagos time)</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-300" />
              <span>{venue}</span>
            </li>
          </ul>
          {action && (
            <div className="pt-2">
              {action}
              {actionHint && <p className="mt-2 text-xs text-white/75">{actionHint}</p>}
            </div>
          )}
        </div>

        <CountdownTiles startsAt={startsAt} />
      </div>
    </GradientBackdrop>
  );
}

/** Live days/hours/minutes/seconds tiles for a start time, driven by the simulated clock. */
export function CountdownTiles({ startsAt, className }: { startsAt: string; className?: string }) {
  const now = useNow(1000);
  const start = DateTime.fromISO(startsAt, { zone: "utc" });
  const remaining = now ? start.toMillis() - now.toMillis() : null;
  const p = remaining === null ? null : parts(remaining);
  const started = remaining !== null && remaining <= 0;
  const units = [
    { label: "Days", value: p?.days },
    { label: "Hours", value: p?.hours },
    { label: "Minutes", value: p?.minutes },
    { label: "Seconds", value: p?.seconds },
  ];
  return (
    <div className={className}>
      <p className="sr-only">
        {started
          ? "The meeting has started."
          : p
            ? `Starts in ${p.days} days, ${p.hours} hours and ${p.minutes} minutes.`
            : ""}
      </p>
      {started ? (
        <p className="rounded-(--radius-md) border border-white/20 bg-white/10 px-5 py-4 text-center font-heading text-xl font-semibold">
          Happening now
        </p>
      ) : (
        <ol aria-hidden className="grid grid-cols-4 gap-2 sm:gap-3">
          {units.map((u) => (
            <li
              key={u.label}
              className="bg-grad-glass flex min-w-0 flex-col items-center rounded-(--radius-md) border border-white/15 px-2 py-3 backdrop-blur-md sm:min-w-20"
            >
              <span className="tabular font-heading text-2xl font-semibold sm:text-[2rem]">
                {u.value === undefined ? "--" : String(u.value).padStart(2, "0")}
              </span>
              <span className="text-[0.625rem] tracking-wide text-white/75 uppercase sm:text-[0.6875rem]">
                {u.label}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
