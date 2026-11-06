/**
 * Illustrative values for the design-system page only. Real screens read data through
 * the repository and compute numbers with src/lib functions.
 */
import type { HeatCell, HeatStatus } from "@/components/charts/Heatmap";
import { lagosTime } from "@/lib/time/zone";

export function sampleHeatCells(): HeatCell[] {
  const cells: HeatCell[] = [];
  const pattern: HeatStatus[] = [
    "ON_TIME",
    "ON_TIME",
    "LATE",
    "ON_TIME",
    "ABSENT",
    "ON_TIME",
    "EXCUSED",
    "ON_TIME",
    "ON_TIME",
    "LATE",
  ];
  // 52 weeks ending Saturday 31 October 2026
  for (let w = 0; w < 52; w++) {
    const sat = lagosTime(2026, 10, 31, 9, 30).minus({ weeks: 51 - w });
    const thu = sat.minus({ days: 2 }).plus({ hours: 11 });
    cells.push({
      date: thu.toISO()!,
      meetingName: "Thursday Prayer Meeting",
      row: "Thu",
      status: pattern[(w * 3) % pattern.length],
    });
    cells.push({
      date: sat.toISO()!,
      meetingName: "Saturday Sanitation Meeting",
      row: "Sat",
      status: w === 44 ? "CANCELLED" : pattern[(w * 7 + 1) % pattern.length],
    });
  }
  return cells;
}

export const trendData = [
  { week: "17 Aug", saturday: 78, thursday: 70 },
  { week: "24 Aug", saturday: 81, thursday: 72 },
  { week: "31 Aug", saturday: 76, thursday: 69 },
  { week: "7 Sep", saturday: 83, thursday: 74 },
  { week: "14 Sep", saturday: 80, thursday: 75 },
  { week: "21 Sep", saturday: 85, thursday: 73 },
  { week: "28 Sep", saturday: 82, thursday: 77 },
  { week: "5 Oct", saturday: 86, thursday: 76 },
  { week: "12 Oct", saturday: 84, thursday: 79 },
  { week: "19 Oct", saturday: 88, thursday: 78 },
  { week: "26 Oct", saturday: 87, thursday: 80 },
  { week: "2 Nov", saturday: 89, thursday: 81 },
];

export const teamData = [
  { team: "Sanctuary A", pct: 88 },
  { team: "Sanctuary B", pct: 84 },
  { team: "Restrooms", pct: 79 },
  { team: "Entrance", pct: 82 },
  { team: "Kitchen", pct: 74 },
  { team: "Outdoors", pct: 77 },
];

export const monthlyStatus = [
  { month: "Jun", onTime: 210, late: 48, absent: 60 },
  { month: "Jul", onTime: 224, late: 51, absent: 55 },
  { month: "Aug", onTime: 230, late: 44, absent: 52 },
  { month: "Sep", onTime: 219, late: 50, absent: 61 },
  { month: "Oct", onTime: 236, late: 47, absent: 49 },
];

export interface SamplePerson {
  id: string;
  name: string;
  team: string;
  role: "Member" | "Volunteer" | "Admin";
  pct: number;
  last: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED";
}

export const samplePeople: SamplePerson[] = [
  { id: "1", name: "Adebayo Johnson", team: "Sanctuary A", role: "Member", pct: 88, last: "ON_TIME" },
  { id: "2", name: "Grace Adeyemi", team: "Sanctuary A", role: "Volunteer", pct: 94, last: "ON_TIME" },
  { id: "3", name: "Chioma Okafor", team: "Kitchen", role: "Member", pct: 52, last: "ABSENT" },
  { id: "4", name: "Ngozi Eze", team: "Entrance", role: "Member", pct: 90, last: "LATE" },
  { id: "5", name: "Emeka Obi", team: "Restrooms", role: "Member", pct: 89.7, last: "ON_TIME" },
  { id: "6", name: "Michael Danjuma", team: "Outdoors", role: "Volunteer", pct: 71, last: "EXCUSED" },
  { id: "7", name: "Ruth Williams", team: "Sanctuary B", role: "Member", pct: 84, last: "ON_TIME" },
];
