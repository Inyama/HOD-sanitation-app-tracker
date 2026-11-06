"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui/empty-state";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { StatusChip } from "@/components/attendance/StatusChip";
import { PERIOD_LABELS, methodLabel, type MemberReport, type PeriodKey } from "@/lib/reports/member-report";

/** My report (spec 7.2): choose a period, preview it, download the PDF statement. */
export function ReportBuilder({ today }: { today: string }) {
  const [period, setPeriod] = React.useState<PeriodKey>("last-3-months");
  const [from, setFrom] = React.useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = React.useState(today);
  const params = new URLSearchParams({ period });
  if (period === "custom") {
    params.set("from", from);
    params.set("to", to);
  }
  const qs = params.toString();
  const q = useQuery({
    queryKey: ["my-report", qs],
    queryFn: async () => {
      const res = await fetch(`/api/v1/me/report?${qs}`);
      if (!res.ok) throw new Error("The report could not be prepared.");
      return (await res.json()) as MemberReport;
    },
  });
  const r = q.data;

  return (
    <div className="space-y-5">
      <GlassCard className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="r-period">Period</Label>
          <NativeSelect id="r-period" value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
              <option key={k} value={k}>
                {PERIOD_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {period === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="r-from">From</Label>
              <input
                id="r-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="h-11 rounded-lg border border-input bg-surface px-3"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-to">To</Label>
              <input
                id="r-to"
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 rounded-lg border border-input bg-surface px-3"
              />
            </div>
          </>
        )}
        <Button asChild variant="role" size="lg" className="ml-auto">
          <a href={`/api/v1/me/report.pdf?${qs}`} download>
            <Download aria-hidden /> Download PDF
          </a>
        </Button>
      </GlassCard>

      {q.isLoading ? (
        <LoadingState rows={4} label="Preparing your report" />
      ) : q.isError || !r ? (
        <ErrorState
          action={
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <section
          aria-label="Report preview"
          className="overflow-hidden rounded-(--radius-xl) border border-border bg-card shadow-soft"
        >
          <div className="bg-grad-hero flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-white">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gold-300 uppercase">
                <FileText aria-hidden className="size-4" /> Attendance statement
              </p>
              <h2 className="mt-1 text-2xl font-semibold">{r.person.name}</h2>
              <p className="text-sm text-white/80">{r.period.label}</p>
            </div>
          </div>
          <div className="grid gap-5 p-6 md:grid-cols-[auto_1fr]">
            <AttendanceRing percent={r.overall.percent} label="Attendance" size={150} />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["On-time rate", r.overall.onTimeRate === null ? "–" : `${r.overall.onTimeRate}%`],
                ["Saturday", r.saturday.percent === null ? "–" : `${r.saturday.percent}%`],
                ["Thursday", r.thursday.percent === null ? "–" : `${r.thursday.percent}%`],
                ["Current streak", String(r.currentStreak)],
                ["On time", String(r.overall.counts.onTime)],
                ["Late", String(r.overall.counts.late)],
                ["Absent", String(r.overall.counts.absent)],
                ["Excused", String(r.overall.counts.excused)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-(--radius-sm) border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="tabular text-lg font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {r.rows.length === 0 ? (
            <EmptyState
              illustration="calendar"
              title="No meetings in this period"
              description="Choose a longer period."
            />
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Meetings in the report"
              className="max-h-[420px] overflow-auto border-t border-border"
            >
              <table className="w-full text-sm">
                <caption className="sr-only">Meetings in the report</caption>
                <thead className="sticky top-0 bg-muted/95 text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-2">
                      Meeting
                    </th>
                    <th scope="col" className="px-4 py-2">
                      Status
                    </th>
                    <th scope="col" className="hidden px-4 py-2 sm:table-cell">
                      Time
                    </th>
                    <th scope="col" className="hidden px-4 py-2 sm:table-cell">
                      Recorded by
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((row) => (
                    <tr key={row.meetingId} className="border-t border-border/70">
                      <td className="px-4 py-2 whitespace-nowrap">{row.dateLabel}</td>
                      <td className="px-4 py-2">{row.meeting}</td>
                      <td className="px-4 py-2">
                        <StatusChip status={row.status} size="sm" />
                      </td>
                      <td className="tabular hidden px-4 py-2 sm:table-cell">{row.checkInTime ?? "–"}</td>
                      <td className="hidden px-4 py-2 sm:table-cell">{methodLabel(row.method)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
