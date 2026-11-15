"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, History, Sheet as SheetIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { ErrorState, LoadingState } from "@/components/ui/empty-state";
import { REPORT_TYPES, type Report, type ReportType } from "@/lib/reports/admin-reports";
import { RANGE_PRESETS } from "@/lib/admin/range";
import { cn } from "@/lib/utils";

export interface ReportHistoryItem {
  id: string;
  atLabel: string;
  by: string;
  label: string;
  format: string;
  period: string;
  href: string | null;
}

const PREVIEW_ROWS = 25;

/** Reports and exports (spec 7.4 item 8): choose, preview from live records, download CSV, XLSX or PDF. */
export function ReportsScreen({
  initialRange,
  today,
  teams,
  people,
  history,
}: {
  initialRange: { value: string; fromDate: string; toDate: string };
  today: string;
  teams: { id: string; name: string }[];
  people: { id: string; name: string }[];
  history: ReportHistoryItem[];
}) {
  const isPreset = RANGE_PRESETS.some((p) => p.key === initialRange.value);
  const [type, setType] = React.useState<ReportType>("MEMBER_SUMMARY");
  const [period, setPeriod] = React.useState(isPreset ? initialRange.value : "custom");
  const [from, setFrom] = React.useState(initialRange.fromDate);
  const [to, setTo] = React.useState(initialRange.toDate);
  const [meetingType, setMeetingType] = React.useState("ALL");
  const [teamId, setTeamId] = React.useState("ALL");
  const [userId, setUserId] = React.useState("");

  const customBad = period === "custom" && (!from || !to || from > to);
  const range = period === "custom" ? `${from}..${to}` : period;
  const params = new URLSearchParams({ type, range, meetingType, teamId });
  if (userId) params.set("userId", userId);
  const qs = params.toString();

  const preview = useQuery({
    queryKey: ["report", qs],
    enabled: !customBad,
    queryFn: async () => {
      const res = await fetch(`/api/v1/admin/reports?${qs}&format=json`, { credentials: "same-origin" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not build the report.");
      return body.report as Report;
    },
  });
  const r = preview.data;

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Report</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {REPORT_TYPES.map((t) => (
              <label
                key={t.key}
                className={cn(
                  "flex min-h-11 cursor-pointer gap-3 rounded-(--radius-md) border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--sky-400)",
                  type === t.key ? "border-role bg-role-soft" : "border-border hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="report-type"
                  value={t.key}
                  checked={type === t.key}
                  onChange={() => setType(t.key)}
                  className="mt-1 accent-(--royal-600)"
                />
                <span>
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="r-period" label="Period">
            {(aria) => (
              <NativeSelect {...aria} value={period} onChange={(e) => setPeriod(e.target.value)}>
                {RANGE_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom dates</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField id="r-type" label="Meetings">
            {(aria) => (
              <NativeSelect {...aria} value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
                <option value="ALL">All meetings</option>
                <option value="SATURDAY">Saturday only</option>
                <option value="THURSDAY_PRAYER">Thursday prayer only</option>
                <option value="SPECIAL">Special events only</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField id="r-team" label="Team">
            {(aria) => (
              <NativeSelect {...aria} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="ALL">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="r-person" label="Person">
            {(aria) => (
              <NativeSelect {...aria} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {period === "custom" && (
            <>
              <FormField id="r-from" label="From" error={customBad ? "Choose a start before the end." : undefined}>
                {(aria) => (
                  <Input {...aria} type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)} />
                )}
              </FormField>
              <FormField id="r-to" label="To">
                {(aria) => (
                  <Input {...aria} type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)} />
                )}
              </FormField>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="mr-1 text-sm font-semibold">Download</span>
          {[
            { f: "csv", label: "CSV", icon: SheetIcon },
            { f: "xlsx", label: "Excel (XLSX)", icon: FileSpreadsheet },
            { f: "pdf", label: "PDF with logo", icon: FileText },
          ].map(({ f, label, icon: Icon }) => (
            <a
              key={f}
              href={customBad ? undefined : `/api/v1/admin/reports?${qs}&format=${f}`}
              aria-disabled={customBad}
              className={cn(
                buttonVariants({ variant: f === "pdf" ? "role" : "outline", size: "sm" }),
                customBad && "pointer-events-none opacity-50",
              )}
              download
            >
              <Icon aria-hidden /> {label}
            </a>
          ))}
          <span className="text-xs text-muted-foreground">
            Files are generated from the live records when you click.
          </span>
        </div>
      </GlassCard>

      <section aria-labelledby="preview-title" aria-busy={preview.isFetching} className="space-y-3">
        <h2 id="preview-title" className="text-lg font-semibold">
          Preview
        </h2>
        {customBad ? (
          <p className="text-sm text-muted-foreground">Choose valid dates to see the preview.</p>
        ) : preview.isError ? (
          <ErrorState description={(preview.error as Error).message} />
        ) : !r ? (
          <LoadingState rows={5} label="Building the report" />
        ) : (
          <GlassCard className="space-y-4">
            <div>
              <h3 className="font-heading text-xl font-semibold">{r.title}</h3>
              <p className="text-sm text-muted-foreground">{r.period}</p>
              {r.filters.length > 0 && <p className="text-sm text-muted-foreground">{r.filters.join(" · ")}</p>}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {r.summary.map(([k, v]) => (
                <div
                  key={k}
                  className={cn("rounded-(--radius-md) border border-border p-3", k === "Key" && "col-span-2")}
                >
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className={cn("tabular font-semibold", k === "Key" ? "text-xs" : "text-lg")}>{v}</dd>
                </div>
              ))}
            </dl>
            {r.tables.map((t) => (
              <div key={t.title} className="space-y-2">
                <h4 className="font-semibold">
                  {t.title} <span className="font-normal text-muted-foreground">({t.rows.length} rows)</span>
                </h4>
                {t.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.note ?? "Nothing to show for this period."}</p>
                ) : (
                  <div
                    className="max-h-[28rem] overflow-auto rounded-(--radius-md) border border-border"
                    tabIndex={0}
                    role="region"
                    aria-label={`${t.title} preview`}
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                        <tr>
                          {t.columns.map((c) => (
                            <th
                              key={c.key}
                              scope="col"
                              className={cn(
                                "px-3 py-2 font-semibold whitespace-nowrap",
                                c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                              )}
                            >
                              {c.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {t.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                          <tr key={i}>
                            {t.columns.map((c) => (
                              <td
                                key={c.key}
                                className={cn(
                                  "tabular px-3 py-1.5 whitespace-nowrap",
                                  c.align === "right"
                                    ? "text-right"
                                    : c.align === "center"
                                      ? "text-center"
                                      : "text-left",
                                )}
                              >
                                {row[c.key] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {t.rows.length > PREVIEW_ROWS && (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {PREVIEW_ROWS} of {t.rows.length} rows. Downloads include every row.
                  </p>
                )}
              </div>
            ))}
          </GlassCard>
        )}
      </section>

      <section aria-labelledby="hist-title" className="space-y-3">
        <h2 id="hist-title" className="flex items-center gap-2 text-lg font-semibold">
          <History aria-hidden className="size-5 text-role-strong" /> Past downloads
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports downloaded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-card">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{h.label}</span> · {h.format.toUpperCase()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.period} · {h.by}, {h.atLabel}
                  </p>
                </div>
                {h.href && (
                  <a
                    href={h.href}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    download
                    aria-label={`Download ${h.label} again`}
                  >
                    <Download aria-hidden /> Again
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
