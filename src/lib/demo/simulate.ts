import { offsetCoordinate } from "@/lib/attendance/geofence";

/** Demo helpers (spec 10.5): Simulate time and Simulate location presets. Demo mode only. */

export interface TimePreset {
  id: string;
  label: string;
  description: string;
  /** UTC ISO instant (Lagos is UTC+1 all year). Literal strings keep this module free of clock reads. */
  at: string;
}

export const TIME_PRESETS: TimePreset[] = [
  {
    id: "fri-now",
    label: "Fri 6 Nov, 10:00",
    description: "Demo today, before the weekend",
    at: "2026-11-06T09:00:00.000Z",
  },
  { id: "sat-0825", label: "Sat 08:25", description: "Window not open yet", at: "2026-11-07T07:25:00.000Z" },
  { id: "sat-0920", label: "Sat 09:20", description: "Window open, On time", at: "2026-11-07T08:20:00.000Z" },
  { id: "sat-0931", label: "Sat 09:31", description: "Window open, counts as Late", at: "2026-11-07T08:31:00.000Z" },
  { id: "sat-1120", label: "Sat 11:20", description: "Ten minutes before close", at: "2026-11-07T10:20:00.000Z" },
  { id: "thu-1930", label: "Thu 19:30", description: "One hour before prayer", at: "2026-11-12T18:30:00.000Z" },
  { id: "thu-2031", label: "Thu 20:31", description: "Prayer under way", at: "2026-11-12T19:31:00.000Z" },
];

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
