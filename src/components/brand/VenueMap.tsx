"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { VenueMapProps } from "./VenueMapInner";

const Inner = dynamic(() => import("./VenueMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" aria-hidden />,
});

/**
 * Leaflet map with OpenStreetMap tiles (no paid key). Loaded only in the browser.
 * The address is always printed next to it, so the map is never the only way to find the venue.
 */
export function VenueMap({ className, ...props }: VenueMapProps) {
  return (
    <div
      role="region"
      aria-label={`Map showing ${props.name}, ${props.address}`}
      className={cn("relative isolate z-0 overflow-hidden", className)}
    >
      <Inner {...props} />
    </div>
  );
}
