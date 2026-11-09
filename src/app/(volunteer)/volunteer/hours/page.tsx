import type { Metadata } from "next";
import { DateTime } from "luxon";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { hoursByMonth, isVerified, summarizeHours } from "@/lib/volunteer/hours";
import { MEETING_ZONE } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { HoursPanel, type HourEntry } from "@/components/volunteer/HoursPanel";

export const metadata: Metadata = { title: "Service hours" };

export default async function HoursPage() {
  const { user } = await requirePage("/volunteer/hours");
  const now = await serverNow();
  const r = repo();
  const [hours, meetings] = await Promise.all([r.serviceHours.list({ where: { userId: user.id } }), r.meetings.list()]);
  const entries: HourEntry[] = [...hours]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((h) => ({
      id: h.id,
      dateLabel: DateTime.fromISO(h.createdAt).setZone(MEETING_ZONE).toFormat("ccc d LLL yyyy"),
      hours: h.hours,
      source: h.source,
      verified: isVerified(h),
      label: h.meetingId
        ? (meetings.find((m) => m.id === h.meetingId)?.title ?? "Meeting")
        : (h.note ?? "Extra service"),
    }));
  const year = now.setZone(MEETING_ZONE).year;
  return (
    <>
      <PageHeader title="Service hours" subtitle="Thank you for every hour you give." />
      <HoursPanel
        summary={summarizeHours(hours, now)}
        months={hoursByMonth(hours, now)}
        entries={entries}
        today={now.setZone(MEETING_ZONE).toISODate()!}
        years={[year, year - 1]}
      />
    </>
  );
}
