import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { isDemoMode } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePage("/admin/settings");
  const r = repo();
  const s = await r.settings.get();
  const venue = (await r.venues.get(s.venueId)) ?? (await r.venues.list())[0];
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Venue pin, check-in rules, percentages and branding. Only Super Admins can change these, and every change is audited."
      />
      <SettingsForm
        demoMode={isDemoMode()}
        initial={{
          venue: {
            name: venue.name,
            address: venue.address,
            lat: venue.lat,
            lng: venue.lng,
            radiusM: venue.radiusM,
            verified: venue.verified,
          },
          maxAccuracyM: s.maxAccuracyM,
          graceMinutes: s.graceMinutes,
          openBeforeMinutes: s.openBeforeMinutes,
          closeAfterMinutes: s.closeAfterMinutes,
          lateWeight: s.lateWeight,
          bandThresholds: s.bandThresholds,
          atRiskPercent: s.atRiskPercent,
          atRiskConsecutiveAbsences: s.atRiskConsecutiveAbsences,
          lowAttendancePercent: s.lowAttendancePercent,
          quietHours: s.quietHours,
          locationRetentionMonths: s.locationRetentionMonths,
          timezone: s.timezone,
          branding: s.branding,
        }}
      />
    </>
  );
}
