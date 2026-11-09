import "server-only";
import { requirePage } from "@/lib/auth/session";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData } from "@/lib/member/data";
import { buildMemberReport, resolvePeriod } from "@/lib/reports/member-report";
import { heatCells } from "@/lib/attendance/heatmap";
import { VIEW_LABELS, type ViewKey } from "@/lib/attendance/aggregate";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { Heatmap } from "@/components/charts/Heatmap";
import { HistoryTable } from "@/components/attendance/HistoryTable";

/** Shared by /member/attendance and /volunteer/attendance; `path` is the page being guarded. */
export async function AttendanceScreen({ path }: { path: string }) {
  const { user } = await requirePage(path);
  const now = await serverNow();
  const d = await loadMemberData(user, now);
  const report = buildMemberReport({
    person: user,
    records: d.records,
    meetings: d.meetings,
    period: resolvePeriod("all", now),
    now,
    lateWeight: d.settings.lateWeight,
  });
  const cells = heatCells(d.meetings, d.records, now);
  const views: ViewKey[] = ["overall", "saturday", "thursday", "last3Months", "yearToDate"];

  return (
    <>
      <PageHeader title="My attendance" subtitle="Every meeting since you joined, with how it was recorded." />
      <div className="space-y-6">
        <section aria-label="Attendance by view" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {views.map((k) => {
            const v = d.views[k];
            return (
              <GlassCard key={k} padding="sm" className="space-y-1">
                <p className="text-xs text-muted-foreground">{VIEW_LABELS[k]}</p>
                <p className="tabular font-heading text-2xl font-semibold">
                  {v.percent === null ? "–" : `${v.percent}%`}
                </p>
                <p className="text-xs text-muted-foreground">{v.band.label}</p>
              </GlassCard>
            );
          })}
        </section>
        <GlassCard>
          <GlassCardHeader
            title="The last 12 months"
            description="One square per meeting. Tab into the grid, then use the arrow keys."
          />
          <Heatmap cells={cells} title="My attendance heatmap" />
        </GlassCard>
        <HistoryTable rows={report.rows} today={now.setZone("Africa/Lagos").toISODate()!} />
      </div>
    </>
  );
}
