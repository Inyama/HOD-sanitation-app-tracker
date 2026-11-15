import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { formatShort, MEETING_ZONE } from "@/lib/time/zone";
import { RANGE_COOKIE, resolveRange } from "@/lib/admin/range";
import { reportHistory } from "@/lib/admin/ops-reports";
import { PageHeader } from "@/components/ui/page-header";
import { ReportsScreen } from "@/components/admin/ReportsScreen";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requirePage("/admin/reports");
  const now = await serverNow();
  const r = repo();
  const range = resolveRange((await cookies()).get(RANGE_COOKIE)?.value, now);
  const [teams, users, history] = await Promise.all([
    r.teams.list({ orderBy: { field: "name" } }),
    r.users.list({ orderBy: { field: "name" } }),
    reportHistory(r),
  ]);
  return (
    <>
      <PageHeader
        title="Reports and exports"
        subtitle="Every figure comes from the live records, using the same rules as the screens."
      />
      <ReportsScreen
        initialRange={{ value: range.value, fromDate: range.fromDate, toDate: range.toDate }}
        today={now.setZone(MEETING_ZONE).toISODate()!}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        people={users
          .filter((u) => u.approvedAt && u.status !== "REMOVED" && u.status !== "PENDING")
          .map((u) => ({ id: u.id, name: u.name }))}
        history={history.map((h) => {
          const q = new URLSearchParams();
          if (h.type && h.format) {
            q.set("type", h.type);
            if (h.range) q.set("range", h.range);
            q.set("meetingType", h.query.meetingType ?? "ALL");
            q.set("teamId", h.query.teamId ?? "ALL");
            if (h.query.userId) q.set("userId", h.query.userId);
            q.set("format", h.format);
          }
          return {
            id: h.id,
            atLabel: formatShort(h.at),
            by: h.by,
            label: h.label,
            format: h.format,
            period: h.period,
            href: h.type && h.format ? `/api/v1/admin/reports?${q.toString()}` : null,
          };
        })}
      />
    </>
  );
}
