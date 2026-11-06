import type { DateTime } from "luxon";
import { now } from "./clock";

/**
 * "Now" for server-rendered screens: the real time, same as the browser's default clock.
 * (Demo "Simulate time" only moves the browser clock; Phase 3 passes it to the server for check-in.)
 */
export function serverNow(): DateTime {
  return now();
}
