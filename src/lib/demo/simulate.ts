import type { DateTime } from "luxon";
import { offsetCoordinate } from "@/lib/attendance/geofence";
import { MEETING_ZONE } from "@/lib/time/zone";

/** Demo helpers (spec 10.5): Simulate time and Simulate location presets. Demo mode only. */

export interface TimePreset {
  id: string;
  label: string;
  description: string;
  /** UTC ISO instant. */
  at: string;
}

/**
 * Simulate-time presets (spec 10.5) for the coming Saturday and Thursday meetings, worked out
 * from the real date: the current Saturday until its window closes at 11:30, and the current
 * Thursday until 21:00.
 */
export function timePresets(realNow: DateTime): TimePreset[] {
  const lagos = realNow.setZone(MEETING_ZONE);
  const upcoming = (weekday: number, endHour: number, endMinute: number) => {
    let d = lagos.startOf("day");
    while (d.weekday !== weekday || lagos > d.set({ hour: endHour, minute: endMinute })) d = d.plus({ days: 1 });
    return d;
  };
  const sat = upcoming(6, 11, 30);
  const thu = upcoming(4, 21, 0);
  const at = (day: DateTime, h: number, m: number) => day.set({ hour: h, minute: m }).toUTC().toISO()!;
  const satLabel = sat.toFormat("ccc d LLL");
  const thuLabel = thu.toFormat("ccc d LLL");
  return [
    { id: "sat-0825", label: "Sat 08:25", description: `${satLabel}: window not open yet`, at: at(sat, 8, 25) },
    { id: "sat-0920", label: "Sat 09:20", description: `${satLabel}: open, On time`, at: at(sat, 9, 20) },
    { id: "sat-0931", label: "Sat 09:31", description: `${satLabel}: open, counts as Late`, at: at(sat, 9, 31) },
    { id: "sat-1120", label: "Sat 11:20", description: `${satLabel}: ten minutes before close`, at: at(sat, 11, 20) },
    { id: "thu-1930", label: "Thu 19:30", description: `${thuLabel}: one hour before prayer`, at: at(thu, 19, 30) },
    { id: "thu-2031", label: "Thu 20:31", description: `${thuLabel}: prayer under way`, at: at(thu, 20, 31) },
  ];
}

export type LocationPresetId = "AT_VENUE" | "FAR_AWAY" | "POOR_ACCURACY" | "GPS_UNAVAILABLE";

export interface LocationPreset {
  id: LocationPresetId;
  label: string;
  description: string;
}

export const LOCATION_PRESETS: LocationPreset[] = [
  { id: "AT_VENUE", label: "At the venue", description: "25 m from the pin, 12 m accuracy" },
  { id: "FAR_AWAY", label: "2 km away", description: "Outside the radius" },
  { id: "POOR_ACCURACY", label: "Poor accuracy", description: "At the venue but 120 m accuracy" },
  { id: "GPS_UNAVAILABLE", label: "GPS unavailable", description: "No position available" },
];

/** A simulated GPS reading for a preset, relative to the venue pin. Null means GPS unavailable. */
export function simulatedReading(
  preset: LocationPresetId,
  venue: { lat: number; lng: number },
): { lat: number; lng: number; accuracyM: number } | null {
  switch (preset) {
    case "AT_VENUE":
      return { ...offsetCoordinate(venue.lat, venue.lng, 25, 0), accuracyM: 12 };
    case "FAR_AWAY":
      return { ...offsetCoordinate(venue.lat, venue.lng, 1400, 1430), accuracyM: 10 };
    case "POOR_ACCURACY":
      return { ...offsetCoordinate(venue.lat, venue.lng, 10, 5), accuracyM: 120 };
    case "GPS_UNAVAILABLE":
      return null;
  }
}
