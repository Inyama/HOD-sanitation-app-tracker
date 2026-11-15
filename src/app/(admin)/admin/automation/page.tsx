import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { formatShort } from "@/lib/time/zone";
import { scheduleLabel } from "@/lib/notifications/automation";
import { loadAutomation } from "@/lib/admin/ops-automation";
import { PageHeader } from "@/components/ui/page-header";
import { AutomationScreen } from "@/components/admin/AutomationScreen";

export const metadata: Metadata = { title: "Automation" };

const STATUSES = ["ALL", "SENT", "FAILED", "SKIPPED"];

export default async function AutomationPage({ searchParams }: PageProps<"/admin/automation">) {
  const { user } = await requirePage("/admin/automation");
  const now = await serverNow();
  const sp = await searchParams;
  const filters = {
    status: typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "ALL",
    type: typeof sp.type === "string" && /^[A-Z_]{2,40}$/.test(sp.type) ? sp.type : "ALL",
  };
  const d = await loadAutomation(repo(), now, user.id, filters);
  const s = d.lastRun.summary;
  return (
    <>
      <PageHeader
        title="Reminders and automation"
        subtitle="Every automated notification, its timing, channels and wording, and what was delivered."
      />
      <AutomationScreen
        rules={d.rules}
        escalation={d.escalation}
        schedule={d.schedule.map((x) => ({
          key: `${x.meetingId}:${x.type}`,
          label: x.label,
          atLabel: scheduleLabel(x.at),
          meetingTitle: x.meetingTitle,
          enabled: x.enabled,
        }))}
        deliveries={d.deliveries.map((x) => ({
          id: x.id,
          atLabel: formatShort(x.createdAt),
          person: x.person,
          type: x.type,
          channel: x.channel,
          status: x.status,
          attempts: x.attempts,
          lastError: x.lastError,
          retryLabel: x.nextRetryAt ? formatShort(x.nextRetryAt) : null,
          subject: x.subject,
        }))}
        totals={d.totals}
        types={d.types}
        filters={filters}
        lastRun={{
          atLabel: d.lastRun.at ? formatShort(d.lastRun.at) : null,
          text: s
            ? `${s.reminders} reminders, ${s.messages} scheduled messages, ${s.closedMeetings} meetings closed, ${s.escalations} escalations (${s.trigger}).`
            : null,
        }}
      />
    </>
  );
}
