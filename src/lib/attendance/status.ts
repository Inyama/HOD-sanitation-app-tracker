import type { DateTime } from "luxon";
import { evaluateLocation, type LocationReading, type VenuePin } from "./geofence";

/** Check-in status rules (spec 6.1). Pure functions; the server passes its own clock. */

export type CheckInStatus = "ON_TIME" | "LATE";

export type CheckInRejection =
  "WINDOW_NOT_OPEN" | "WINDOW_CLOSED" | "OUT_OF_RANGE" | "LOW_ACCURACY" | "ALREADY_CHECKED_IN" | "MEETING_CANCELLED";

export interface WindowRules {
  graceMinutes: number; // default 0
  openBeforeMinutes: number; // default 60
  closeAfterMinutes: number; // default 120
}

export const DEFAULT_WINDOW: WindowRules = { graceMinutes: 0, openBeforeMinutes: 60, closeAfterMinutes: 120 };

export function evaluateCheckInTime(
  nowUtc: DateTime,
  meetingStartUtc: DateTime,
  rules: WindowRules,
): { ok: true; status: CheckInStatus } | { ok: false; reason: CheckInRejection } {
  const opens = meetingStartUtc.minus({ minutes: rules.openBeforeMinutes });
  const closes = meetingStartUtc.plus({ minutes: rules.closeAfterMinutes });
  if (nowUtc < opens) return { ok: false, reason: "WINDOW_NOT_OPEN" };
  if (nowUtc > closes) return { ok: false, reason: "WINDOW_CLOSED" };
  const lateAfter = meetingStartUtc.plus({ minutes: rules.graceMinutes });
  return { ok: true, status: nowUtc <= lateAfter ? "ON_TIME" : "LATE" };
}

export function checkInWindow(meetingStartUtc: DateTime, rules: WindowRules) {
  return {
    opensAt: meetingStartUtc.minus({ minutes: rules.openBeforeMinutes }),
    lateAfter: meetingStartUtc.plus({ minutes: rules.graceMinutes }),
    closesAt: meetingStartUtc.plus({ minutes: rules.closeAfterMinutes }),
  };
}

export type WindowPhase = "BEFORE" | "OPEN_ON_TIME" | "OPEN_LATE" | "CLOSED";

/** Where "now" sits relative to a meeting's check-in window. */
export function windowPhase(nowUtc: DateTime, meetingStartUtc: DateTime, rules: WindowRules): WindowPhase {
  const r = evaluateCheckInTime(nowUtc, meetingStartUtc, rules);
  if (r.ok) return r.status === "ON_TIME" ? "OPEN_ON_TIME" : "OPEN_LATE";
  return r.reason === "WINDOW_NOT_OPEN" ? "BEFORE" : "CLOSED";
}

export interface CheckInInput {
  nowUtc: DateTime;
  meetingStartUtc: DateTime;
  meetingCancelled: boolean;
  alreadyCheckedIn: boolean;
  rules: WindowRules;
  reading: LocationReading;
  venue: VenuePin;
  maxAccuracyM?: number;
}

export type CheckInResult =
  { ok: true; status: CheckInStatus; distanceM: number } | { ok: false; reason: CheckInRejection; distanceM?: number };

/**
 * Full geolocation check-in decision in a fixed order: cancelled, already checked in,
 * time window, GPS accuracy, then distance. Status and time always come from the server clock.
 */
export function evaluateCheckIn(input: CheckInInput): CheckInResult {
  if (input.meetingCancelled) return { ok: false, reason: "MEETING_CANCELLED" };
  if (input.alreadyCheckedIn) return { ok: false, reason: "ALREADY_CHECKED_IN" };
  const time = evaluateCheckInTime(input.nowUtc, input.meetingStartUtc, input.rules);
  if (!time.ok) return time;
  const loc = evaluateLocation(input.reading, input.venue, input.maxAccuracyM);
  if (!loc.ok)
    return loc.reason === "OUT_OF_RANGE"
      ? { ok: false, reason: loc.reason, distanceM: loc.distanceM }
      : { ok: false, reason: loc.reason };
  return { ok: true, status: time.status, distanceM: loc.distanceM };
}

export const REJECTION_MESSAGES: Record<CheckInRejection, string> = {
  WINDOW_NOT_OPEN: "Check-in is not open yet.",
  WINDOW_CLOSED: "Check-in for this meeting has closed.",
  OUT_OF_RANGE: "You are outside the venue area.",
  LOW_ACCURACY: "Your GPS signal is too weak. Move outdoors and retry.",
  ALREADY_CHECKED_IN: "You have already checked in for this meeting.",
  MEETING_CANCELLED: "This meeting has been cancelled.",
};
