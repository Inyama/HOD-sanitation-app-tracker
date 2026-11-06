/** Geofence and anti-spoofing rules (spec 6.2). Pure functions. */

const R = 6371000; // metres
const rad = (d: number) => (d * Math.PI) / 180;

export interface LocationReading {
  lat: number;
  lng: number;
  accuracyM: number;
}

export interface VenuePin {
  lat: number;
  lng: number;
  radiusM: number;
}

export const DEFAULT_RADIUS_M = 100;
export const MIN_RADIUS_M = 50;
export const MAX_RADIUS_M = 300;
export const DEFAULT_MAX_ACCURACY_M = 50;

/** Great-circle distance in metres (haversine). */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function evaluateLocation(p: LocationReading, venue: VenuePin, maxAccuracyM = DEFAULT_MAX_ACCURACY_M) {
  if (p.accuracyM > maxAccuracyM) return { ok: false as const, reason: "LOW_ACCURACY" as const };
  const d = distanceMetres(p.lat, p.lng, venue.lat, venue.lng);
  return d <= venue.radiusM
    ? { ok: true as const, distanceM: d }
    : { ok: false as const, reason: "OUT_OF_RANGE" as const, distanceM: d };
}

export function clampRadius(m: number): number {
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(m)));
}

/** Move a point by metres north and east (small-distance approximation; used for demo presets and jitter). */
export function offsetCoordinate(
  lat: number,
  lng: number,
  northM: number,
  eastM: number,
): { lat: number; lng: number } {
  const dLat = northM / R;
  const dLng = eastM / (R * Math.cos(rad(lat)));
  return { lat: lat + (dLat * 180) / Math.PI, lng: lng + (dLng * 180) / Math.PI };
}

// ---------------------------------------------------------------------------
// Anti-spoofing flags. A flagged check-in is saved with flagged = true and the
// reasons, and goes to Corrections; it is never silently rejected.
// ---------------------------------------------------------------------------

export type SpoofFlag = "SHARED_DEVICE" | "IMPOSSIBLE_JUMP" | "SUSPICIOUS_COORDINATES" | "TOO_MANY_ATTEMPTS";

export interface CheckInAttempt {
  userId: string;
  meetingId: string;
  deviceId: string | null;
  lat: number;
  lng: number;
  accuracyM: number;
  atMs: number;
}

export interface SpoofContext {
  /** Other check-ins already made for the same meeting (any account). */
  sameMeetingCheckIns: { userId: string; deviceId: string | null }[];
  /** This person's most recent previous check-in, any meeting. */
  previousCheckIn?: { lat: number; lng: number; atMs: number } | null;
  /** Number of check-in attempts by this person in the 10 minutes before this one. */
  attemptsLast10Min: number;
}

export const SPOOF_FLAG_TEXT: Record<SpoofFlag, string> = {
  SHARED_DEVICE: "Device already used by another account for this meeting",
  IMPOSSIBLE_JUMP: "Moved more than 2 km from the previous check-in in under 30 minutes",
  SUSPICIOUS_COORDINATES: "GPS accuracy of exactly 0 or a perfectly round coordinate",
  TOO_MANY_ATTEMPTS: "More than 5 attempts in 10 minutes",
};

function decimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = Math.abs(n).toString();
  if (s.includes("e")) return 0;
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

/** Real GPS fixes carry five or more decimals; three or fewer on both axes looks typed in. */
export function isRoundCoordinate(lat: number, lng: number): boolean {
  return decimals(lat) <= 3 && decimals(lng) <= 3;
}

export function spoofFlags(a: CheckInAttempt, ctx: SpoofContext): SpoofFlag[] {
  const flags: SpoofFlag[] = [];
  if (a.deviceId && ctx.sameMeetingCheckIns.some((c) => c.deviceId === a.deviceId && c.userId !== a.userId)) {
    flags.push("SHARED_DEVICE");
  }
  const prev = ctx.previousCheckIn;
  if (prev && a.atMs - prev.atMs < 30 * 60_000 && a.atMs >= prev.atMs) {
    if (distanceMetres(prev.lat, prev.lng, a.lat, a.lng) > 2000) flags.push("IMPOSSIBLE_JUMP");
  }
  if (a.accuracyM === 0 || isRoundCoordinate(a.lat, a.lng)) flags.push("SUSPICIOUS_COORDINATES");
  if (ctx.attemptsLast10Min + 1 > 5) flags.push("TOO_MANY_ATTEMPTS");
  return flags;
}

export function describeFlags(flags: SpoofFlag[]): string | null {
  return flags.length ? flags.map((f) => SPOOF_FLAG_TEXT[f]).join("; ") : null;
}
