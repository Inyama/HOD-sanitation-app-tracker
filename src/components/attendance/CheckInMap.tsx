"use client";

import dynamic from "next/dynamic";
import type { CheckInMapProps } from "./CheckInMapInner";

const Inner = dynamic(() => import("./CheckInMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" aria-hidden />,
});

/** Venue pin, check-in radius and (once located) the member's position with its accuracy circle. */
export function CheckInMap(props: CheckInMapProps) {
  const label = props.me
    ? `Map: your position and the venue, ${props.venue.radiusM} metre check-in area shown`
    : `Map: the venue and its ${props.venue.radiusM} metre check-in area`;
  return (
    <div
      role="region"
      aria-label={label}
      className="relative isolate z-0 h-64 overflow-hidden rounded-(--radius-lg) border border-border sm:h-80"
    >
      <Inner {...props} />
    </div>
  );
}
