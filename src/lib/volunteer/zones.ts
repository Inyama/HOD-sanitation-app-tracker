/**
 * Zone details for the duty board (spec 7.3). Capacity is the number of volunteers each zone
 * needs on a Saturday; arrival is how many minutes before the meeting start to report.
 * Admins will adjust these on the Duty roster screen (Phase 6).
 */

export interface ZoneInfo {
  capacity: number;
  arriveMinutesBefore: number;
  supplies: string[];
  tasks: string;
}

export const ZONE_INFO: Record<string, ZoneInfo> = {
  Sanctuary: {
    capacity: 5,
    arriveMinutesBefore: 15,
    supplies: ["Vacuum cleaner", "Microfibre cloths", "Wood polish"],
    tasks: "Vacuum aisles, wipe pews and the stage, reset chairs",
  },
  Restrooms: {
    capacity: 3,
    arriveMinutesBefore: 15,
    supplies: ["Gloves", "Disinfectant", "Toilet brushes", "Refill paper and soap"],
    tasks: "Clean and disinfect, restock paper and soap, mop floors",
  },
  Entrance: {
    capacity: 3,
    arriveMinutesBefore: 30,
    supplies: ["Brooms", "Glass cleaner", "Doormats"],
    tasks: "Sweep the gate and walkway, clean glass doors, lay doormats",
  },
  Kitchen: {
    capacity: 3,
    arriveMinutesBefore: 30,
    supplies: ["Degreaser", "Sponges", "Bin liners"],
    tasks: "Degrease surfaces, clean the hob, empty and reline bins",
  },
  Outdoors: {
    capacity: 4,
    arriveMinutesBefore: 15,
    supplies: ["Rakes", "Gloves", "Refuse sacks", "Wheelbarrow"],
    tasks: "Clear gutters and drains, sweep the car park, collect litter",
  },
};

const FALLBACK: ZoneInfo = {
  capacity: 3,
  arriveMinutesBefore: 15,
  supplies: ["Gloves"],
  tasks: "As directed by the Zone Captain",
};

export function zoneInfo(name: string): ZoneInfo {
  return ZONE_INFO[name] ?? FALLBACK;
}
