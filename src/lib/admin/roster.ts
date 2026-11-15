import type { DutyAssignment, DutyStatus } from "@/lib/repo/types";
import { holdsSpot } from "@/lib/volunteer/duties";

/**
 * Duty roster (spec 7.4 item 14): auto-suggest people for open spots from past assignments.
 * Pure; the screen shows each suggestion with its reason before anything is saved.
 */

export interface RosterZone {
  id: string;
  name: string;
  capacity: number;
}

export interface RosterVolunteer {
  id: string;
  name: string;
  /** Zone of the person's team, if any. */
  teamZoneId: string | null;
}

export interface Suggestion {
  userId: string;
  zoneId: string;
  reason: string;
}

/**
 * Fill open spots: people who served in that zone most often come first, then members of the
 * zone's team, then those with the fewest duties overall (to share the load). Nobody is
 * suggested twice, and people already on the roster for this meeting are left alone.
 */
export function suggestRoster(input: {
  zones: RosterZone[];
  volunteers: RosterVolunteer[];
  past: Pick<DutyAssignment, "userId" | "zoneId" | "status">[];
  current: Pick<DutyAssignment, "userId" | "zoneId" | "status">[];
  unavailable?: Set<string>;
}): Suggestion[] {
  const held = input.current.filter((d) => holdsSpot(d.status));
  const busy = new Set([...held.map((d) => d.userId), ...(input.unavailable ?? [])]);
  const served = (u: string, z: string) =>
    input.past.filter((d) => d.userId === u && d.zoneId === z && countsAsServed(d.status)).length;
  const total = (u: string) => input.past.filter((d) => d.userId === u && countsAsServed(d.status)).length;

  const open = input.zones
    .map((z) => ({ zone: z, open: Math.max(0, z.capacity - held.filter((d) => d.zoneId === z.id).length) }))
    .filter((x) => x.open > 0)
    .sort((a, b) => b.open - a.open || a.zone.name.localeCompare(b.zone.name));

  const out: Suggestion[] = [];
  // Round-robin over zones so one zone does not take every experienced person.
  let progress = true;
  while (progress) {
    progress = false;
    for (const slot of open) {
      if (slot.open === 0) continue;
      const pick = input.volunteers
        .filter((v) => !busy.has(v.id))
        .map((v) => ({ v, here: served(v.id, slot.zone.id), team: v.teamZoneId === slot.zone.id, all: total(v.id) }))
        .sort(
          (a, b) =>
            b.here - a.here || Number(b.team) - Number(a.team) || a.all - b.all || a.v.name.localeCompare(b.v.name),
        )[0];
      if (!pick) continue;
      busy.add(pick.v.id);
      slot.open--;
      progress = true;
      out.push({
        userId: pick.v.id,
        zoneId: slot.zone.id,
        reason:
          pick.here > 0
            ? `Served here ${pick.here} ${pick.here === 1 ? "time" : "times"}`
            : pick.team
              ? `In the ${slot.zone.name} team`
              : pick.all === 0
                ? "New to duties"
                : "Free this Saturday",
      });
    }
  }
  return out;
}

function countsAsServed(s: DutyStatus) {
  return s === "DONE" || s === "ASSIGNED";
}

/** Can this person be moved into the zone? (one duty per Saturday, zone not full) */
export function canPlace(
  zone: RosterZone,
  current: Pick<DutyAssignment, "userId" | "zoneId" | "status">[],
  userId: string,
): "OK" | "FULL" | "SAME_ZONE" {
  const held = current.filter((d) => holdsSpot(d.status));
  const mine = held.find((d) => d.userId === userId);
  if (mine?.zoneId === zone.id) return "SAME_ZONE";
  if (held.filter((d) => d.zoneId === zone.id).length >= zone.capacity) return "FULL";
  return "OK";
}
