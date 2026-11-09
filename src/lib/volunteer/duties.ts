import { DateTime } from "luxon";
import type { DutyAssignment, DutyStatus, Zone } from "@/lib/repo/types";
import { zoneInfo } from "./zones";

/**
 * Duty board rules (spec 7.3). Pure functions.
 * - Each Saturday, each zone has a number of spots (capacity).
 * - A person holds at most one duty per meeting.
 * - ASSIGNED and SWAP_REQUESTED hold a spot; SWAPPED (released) frees it.
 * - You can withdraw yourself until 12 hours before the start; after that you request a swap,
 *   which a Team Lead or admin approves.
 */

export const WITHDRAW_CUTOFF_HOURS = 12;
const HOLDS_SPOT: DutyStatus[] = ["ASSIGNED", "SWAP_REQUESTED", "DONE"];

export interface BoardZone {
  zoneId: string;
  name: string;
  description: string | null;
  capacity: number;
  taken: number;
  open: number;
  tasks: string;
  supplies: string[];
  assignees: { dutyId: string; userId: string; status: DutyStatus }[];
  mine: { dutyId: string; status: DutyStatus } | null;
}

export function holdsSpot(status: DutyStatus): boolean {
  return HOLDS_SPOT.includes(status);
}

export function buildDutyBoard(
  zones: Zone[],
  duties: DutyAssignment[],
  meetingId: string,
  userId: string,
): BoardZone[] {
  return zones.map((z) => {
    const info = zoneInfo(z.name);
    const here = duties.filter((d) => d.meetingId === meetingId && d.zoneId === z.id && holdsSpot(d.status));
    const mine = here.find((d) => d.userId === userId);
    return {
      zoneId: z.id,
      name: z.name,
      description: z.description,
      capacity: info.capacity,
      taken: here.length,
      open: Math.max(0, info.capacity - here.length),
      tasks: info.tasks,
      supplies: info.supplies,
      assignees: here.map((d) => ({ dutyId: d.id, userId: d.userId, status: d.status })),
      mine: mine ? { dutyId: mine.id, status: mine.status } : null,
    };
  });
}

export type DutyRefusal =
  "MEETING_PAST" | "ALREADY_ON_DUTY" | "ZONE_FULL" | "TOO_LATE_TO_WITHDRAW" | "NOT_YOURS" | "NOT_SWAPPABLE";

export const DUTY_MESSAGES: Record<DutyRefusal, string> = {
  MEETING_PAST: "This meeting has already started.",
  ALREADY_ON_DUTY: "You already have a duty for this meeting. Withdraw from it first.",
  ZONE_FULL: "This zone is full. Choose another zone.",
  TOO_LATE_TO_WITHDRAW: `It is less than ${WITHDRAW_CUTOFF_HOURS} hours to the meeting. Request a swap instead, so your Team Lead can cover the spot.`,
  NOT_YOURS: "That duty is not yours.",
  NOT_SWAPPABLE: "A swap can only be requested for a duty you hold.",
};

export function canSignUp(input: {
  now: DateTime;
  meetingStart: string;
  zone: BoardZone;
  myDutiesForMeeting: DutyAssignment[];
}): { ok: true } | { ok: false; reason: DutyRefusal } {
  if (DateTime.fromISO(input.meetingStart) <= input.now) return { ok: false, reason: "MEETING_PAST" };
  if (input.myDutiesForMeeting.some((d) => holdsSpot(d.status))) return { ok: false, reason: "ALREADY_ON_DUTY" };
  if (input.zone.open <= 0) return { ok: false, reason: "ZONE_FULL" };
  return { ok: true };
}

export function canWithdraw(now: DateTime, meetingStart: string): { ok: true } | { ok: false; reason: DutyRefusal } {
  const start = DateTime.fromISO(meetingStart);
  if (start <= now) return { ok: false, reason: "MEETING_PAST" };
  if (start.diff(now, "hours").hours < WITHDRAW_CUTOFF_HOURS) return { ok: false, reason: "TOO_LATE_TO_WITHDRAW" };
  return { ok: true };
}

/** Arrival time for a zone on a meeting (start minus the zone's arrival lead time). */
export function arrivalTime(meetingStart: string, zoneName: string): DateTime {
  return DateTime.fromISO(meetingStart, { zone: "utc" }).minus({ minutes: zoneInfo(zoneName).arriveMinutesBefore });
}
