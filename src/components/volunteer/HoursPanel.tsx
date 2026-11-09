"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, Clock3, Hourglass, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StackedBars } from "@/components/charts/StackedBars";
import { apiRequest } from "@/lib/api-client";
import type { HoursSummary, MonthHours } from "@/lib/volunteer/hours";
import { cn } from "@/lib/utils";

export interface HourEntry {
  id: string;
  dateLabel: string;
  hours: number;
  source: "AUTO" | "MANUAL";
  verified: boolean;
  label: string;
}

/** Service hours (spec 7.3): automatic and manual hours, monthly chart, certificate. */
export function HoursPanel({
  summary,
  months,
  entries,
  today,
  years,
}: {
  summary: HoursSummary;
  months: MonthHours[];
  entries: HourEntry[];
  today: string;
  years: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ date: today, hours: "2", note: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [year, setYear] = React.useState(years[0]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await apiRequest("/api/v1/hours", {
      body: { date: form.date, hours: Number(form.hours), note: form.note },
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? { form: r.message });
      return;
    }
    setErrors({});
    setOpen(false);
    setForm({ date: today, hours: "2", note: "" });
    toast.success("Hours logged", { description: "An admin will verify them." });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Clock3, label: "This month", value: summary.thisMonth },
          { icon: Award, label: "This year", value: summary.thisYear },
          { icon: Clock3, label: "All time", value: summary.allTime },
          { icon: Hourglass, label: "Waiting for verification", value: summary.pending },
        ].map(({ icon: Icon, label, value }) => (
          <GlassCard key={label} className="flex flex-col gap-1">
            <Icon aria-hidden className="size-5 text-role-strong" />
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="tabular font-heading text-3xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">hours</p>
          </GlassCard>
        ))}
      </section>

      <StackedBars
        title="Hours by month"
        description="Verified hours, and manual hours waiting for an admin"
        data={months.map((m) => ({
          month: `${m.label} ${m.month.slice(2, 4)}`,
          verified: m.verified,
          pending: m.pending,
        }))}
        xKey="month"
        xLabel="Month"
        series={[
          { key: "verified", label: "Verified", color: "var(--series-3)" },
          { key: "pending", label: "Waiting", color: "var(--series-2)" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <GlassCard>
          <GlassCardHeader
            title="Entries"
            description="Saturday and event hours are added automatically when you check in."
            action={
              <Button variant="role" size="sm" onClick={() => setOpen(true)}>
                <Plus aria-hidden /> Log hours
              </Button>
            }
          />
          {entries.length === 0 ? (
            <EmptyState
              illustration="calendar"
              title="No hours yet"
              description="Check in on Saturday or log extra service here."
            />
          ) : (
            <ul
              tabIndex={0}
              aria-label="Service hour entries"
              className="max-h-[420px] divide-y divide-border overflow-auto"
            >
              {entries.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">{h.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.dateLabel} · {h.source === "AUTO" ? "Automatic from check-in" : "Logged by you"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        h.verified
                          ? "bg-(--status-ontime-bg) text-(--status-ontime-fg)"
                          : "bg-(--status-late-bg) text-(--status-late-fg)",
                      )}
                    >
                      {h.verified ? "Verified" : "Waiting"}
                    </span>
                    <span className="tabular w-12 text-right font-semibold">{h.hours} h</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
        <GlassCard tone="accent" className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Award aria-hidden className="size-5 text-role-strong" /> Certificate of service
          </h2>
          <p className="text-sm">A PDF certificate with the unit logo and your verified hours for the year.</p>
          <div className="space-y-1.5">
            <label htmlFor="cert-year" className="text-sm font-medium">
              Year
            </label>
            <NativeSelect id="cert-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button asChild variant="role">
            <a href={`/api/v1/hours/certificate.pdf?year=${year}`} download>
              <Award aria-hidden /> Download certificate
            </a>
          </Button>
        </GlassCard>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">Log service hours</SheetTitle>
            <SheetDescription>
              For service outside the Saturday check-in, such as a midweek clean or a supplies run.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={submit} noValidate className="space-y-4 px-4 pb-6">
            {errors.form && (
              <p role="alert" className="text-sm text-(--status-absent-fg)">
                {errors.form}
              </p>
            )}
            <FormField id="h-date" label="Date" error={errors.date} required>
              {(aria) => (
                <Input
                  {...aria}
                  type="date"
                  max={today}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              )}
            </FormField>
            <FormField
              id="h-hours"
              label="Hours"
              error={errors.hours}
              hint="Half hours are fine, for example 1.5."
              required
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                />
              )}
            </FormField>
            <FormField id="h-note" label="What did you do?" error={errors.note} required>
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  maxLength={300}
                />
              )}
            </FormField>
            <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} Log hours
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
