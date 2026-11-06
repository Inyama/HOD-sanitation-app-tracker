import { DateTime } from "luxon";
import { MEETING_ZONE } from "@/lib/time/zone";

/** Small display helpers shared by member screens (no business rules here). */

export function lagosClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(MEETING_ZONE).toFormat("h:mm a").toLowerCase();
}

export function lagosDay(iso: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(MEETING_ZONE).toFormat("ccc d LLL");
}

export function typeLabel(type: string): string {
  return type === "SATURDAY" ? "Saturday meeting" : type === "THURSDAY_PRAYER" ? "Prayer meeting" : "Special event";
}

export function isRescheduled(statusNote: string | null | undefined): boolean {
  return !!statusNote && /^rescheduled/i.test(statusNote);
}
