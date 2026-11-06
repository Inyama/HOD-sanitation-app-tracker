import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { formatForViewer, formatShort } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsPanels, type LocationUse } from "@/components/member/SettingsPanels";

export const metadata: Metadata = { title: "Profile and settings" };

export default async function SettingsPage() {
  const { user } = await requirePage("/member/settings");
  const r = repo();
  const [records, meetings] = await Promise.all([r.records.list({ where: { userId: user.id } }), r.meetings.list()]);
  const locations: LocationUse[] = records
    .filter((x) => x.lat !== null && x.lng !== null && x.checkedInAt)
    .sort((a, b) => b.checkedInAt!.localeCompare(a.checkedInAt!))
    .map((x) => {
      const m = meetings.find((mm) => mm.id === x.meetingId);
      return {
        id: x.id,
        when: formatForViewer(x.checkedInAt!, user.timezone),
        meeting: m ? `${m.title}, ${formatShort(m.startsAt)}` : x.meetingId,
        distanceM: x.distanceM,
        accuracyM: x.accuracyM,
        coords: `${x.lat!.toFixed(5)}, ${x.lng!.toFixed(5)}`,
      };
    });
  return (
    <>
      <PageHeader title="Profile and settings" subtitle="Your details, reminders, password and privacy." />
      <SettingsPanels
        profile={{
          name: user.name,
          email: user.email,
          phone: user.phone,
          city: user.city,
          country: user.country,
          timezone: user.timezone,
          language: user.language,
          avatarUrl: user.avatarUrl,
          isRemote: user.isRemote,
          deletionRequestedAt: user.deletionRequestedAt,
        }}
        prefs={user.notifPrefs}
        locations={locations}
      />
    </>
  );
}
