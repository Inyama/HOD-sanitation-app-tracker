import type { Metadata } from "next";
import { DateTime } from "luxon";
import { requirePage } from "@/lib/auth/session";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData } from "@/lib/member/data";
import { googleCalendarUrl, outlookCalendarUrl } from "@/lib/reports/calendar";
import { appUrl } from "@/lib/notifications/senders";
import { PageHeader } from "@/components/ui/page-header";
import { ScheduleView, type ScheduleItem } from "@/components/member/ScheduleView";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const { user } = await requirePage("/member/schedule");
  const now = await serverNow();
  const d = await loadMemberData(user, now);
  const ctx = { address: d.venue.address, appUrl: appUrl() };
  const from = now.minus({ weeks: 6 });
  const items: ScheduleItem[] = d.meetings
    .filter((m) => DateTime.fromISO(m.startsAt) >= from)
    .map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      startsAt: m.startsAt,
      status: m.status,
      statusNote: m.statusNote,
      method: m.method,
      google: googleCalendarUrl(m, ctx),
      outlook: outlookCalendarUrl(m, ctx),
    }));
  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Meetings and events. Times shown in your time zone (${user.timezone.replace("_", " ")}) with Lagos time where different.`}
      />
      <ScheduleView items={items} today={now.setZone("Africa/Lagos").toISODate()!} viewerZone={user.timezone} />
    </>
  );
}
