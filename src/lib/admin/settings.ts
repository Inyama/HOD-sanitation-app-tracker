import type { AppSettings, Venue } from "@/lib/repo/types";

/** Settings screen helpers (spec 7.4 item 17): labels and a readable list of what changed for the audit log. */

export const SETTING_LABELS: Record<string, string> = {
  graceMinutes: "Grace period (minutes)",
  openBeforeMinutes: "Check-in opens (minutes before)",
  closeAfterMinutes: "Check-in closes (minutes after)",
  maxAccuracyM: "Accuracy threshold (m)",
  lateWeight: "Late weight",
  "bandThresholds.gold": "Gold band from (%)",
  "bandThresholds.green": "Green band from (%)",
  "bandThresholds.amber": "Amber band from (%)",
  atRiskPercent: "At risk below (%)",
  atRiskConsecutiveAbsences: "At risk after absences in a row",
  lowAttendancePercent: "Low-attendance alert below (%)",
  "quietHours.start": "Quiet hours start",
  "quietHours.end": "Quiet hours end",
  locationRetentionMonths: "Keep location data (months)",
  timezone: "Time zone",
  "branding.primary": "Primary colour",
  "branding.accent": "Accent colour",
  "branding.logoUrl": "Logo",
  "venue.name": "Venue name",
  "venue.address": "Venue address",
  "venue.lat": "Venue latitude",
  "venue.lng": "Venue longitude",
  "venue.radiusM": "Geofence radius (m)",
  "venue.verified": "Pin confirmed on site",
};

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, key));
    else out[key] = v;
  }
  return out;
}

export interface SettingChange {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
}

/** Changed keys between two settings snapshots (venue fields under "venue."). */
export function settingsChanges(
  before: { settings: AppSettings; venue: Pick<Venue, "name" | "address" | "lat" | "lng" | "radiusM" | "verified"> },
  after: { settings: AppSettings; venue: Pick<Venue, "name" | "address" | "lat" | "lng" | "radiusM" | "verified"> },
): SettingChange[] {
  const b = flatten({ ...before.settings, venue: before.venue } as unknown as Record<string, unknown>);
  const a = flatten({ ...after.settings, venue: after.venue } as unknown as Record<string, unknown>);
  return Object.keys(SETTING_LABELS)
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ key: k, label: SETTING_LABELS[k], before: b[k], after: a[k] }));
}

/** Before and after objects for the audit entry, keeping only what changed. */
export function changeSnapshot(changes: SettingChange[]) {
  return {
    before: Object.fromEntries(changes.map((c) => [c.key, c.before])),
    after: Object.fromEntries(changes.map((c) => [c.key, c.after])),
  };
}
