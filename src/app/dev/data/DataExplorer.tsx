"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Clock3,
  Flag,
  MapPin,
  RotateCcw,
  TriangleAlert,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { KpiCard } from "@/components/charts/KpiCard";
import { Donut } from "@/components/charts/Donut";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, LoadingState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/attendance/StatusChip";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useNow } from "@/hooks/use-now";
import { resetClock, simulateTime } from "@/lib/time/clock";
import { TIME_PRESETS } from "@/lib/demo/simulate";
import type { DemoSummary } from "@/lib/demo/summary";
import { cn } from "@/lib/utils";

type Account = DemoSummary["demoAccounts"][number];

const bandStyle: Record<string, string> = {
  gold: "bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-300",
  green: "bg-(--status-ontime-bg) text-(--status-ontime-fg)",
  amber: "bg-(--status-late-bg) text-(--status-late-fg)",
  red: "bg-(--status-absent-bg) text-(--status-absent-fg)",
  none: "bg-muted text-muted-foreground",
};

const phaseText: Record<string, string> = {
  BEFORE: "Check-in not open yet",
  OPEN_ON_TIME: "Check-in open: arrivals are On time",
  OPEN_LATE: "Check-in open: arrivals count as Late",
  CLOSED: "Check-in closed",
};

const typeLabel: Record<string, string> = {
  SAT_DAY_BEFORE: "Saturday: day before",
  SAT_HOUR_BEFORE: "Saturday: check-in open",
  SAT_LATE_NOTICE: "Saturday: late notice",
  SAT_WINDOW_CLOSING: "Saturday: window closing",
  THU_DAY_BEFORE: "Thursday: day before",
  THU_HOUR_BEFORE: "Thursday: hour before",
  THU_STARTING: "Thursday: starting now",
  ABSENCE_FOLLOWUP: "Absence follow-up",
  WEEKLY_SUMMARY: "Weekly summary",
  LOW_ATTENDANCE: "Low attendance",
  EVENT_DAY_BEFORE: "Event: day before",
  EVENT_HOUR_BEFORE: "Event: hour before",
};

async function fetchSummary(at: string): Promise<DemoSummary> {
  const res = await fetch(`/api/v1/demo/summary?at=${encodeURIComponent(at)}`);
  if (!res.ok) throw new Error(`The demo summary could not be loaded (${res.status}).`);
  return res.json();
}

export function DataExplorer() {
  const now = useNow(1000);
  const [activePreset, setActivePreset] = React.useState<string | null>(null);
  // Re-query once per simulated minute.
  const minute = now ? now.startOf("minute").toISO()! : null;
  const query = useQuery({
    queryKey: ["demo-summary", minute],
    queryFn: () => fetchSummary(minute!),
    enabled: !!minute,
    placeholderData: (prev) => prev,
  });
  const s = query.data;

  const choosePreset = (id: string, at: string) => {
    setActivePreset(id);
    simulateTime(at);
  };

  const columns: Column<Account>[] = [
    {
      key: "name",
      header: "Account",
      primary: true,
      sortValue: (a) => a.name,
      cell: (a) => (
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <UserAvatar name={a.name} size={32} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{a.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (a) => a.role,
      cell: (a) => (
        <span className="inline-flex flex-col items-start gap-1">
          <RoleBadge role={a.role.toLowerCase() as "member" | "volunteer" | "admin"} />
          {a.roleDetail && <span className="text-xs text-muted-foreground">{a.roleDetail}</span>}
          {a.status !== "ACTIVE" && <span className="text-xs font-semibold text-(--status-absent-fg)">{a.status}</span>}
        </span>
      ),
    },
    {
      key: "pct",
      header: "Attendance",
      align: "right",
      sortValue: (a) => a.percent ?? -1,
      cell: (a) => (
        <span className="inline-flex flex-col items-end gap-1">
          <span className="text-base font-semibold">{a.percent === null ? "–" : `${a.percent.toFixed(1)}%`}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", bandStyle[a.band.key])}>
            {a.band.label}
          </span>
        </span>
      ),
    },
    {
      key: "counts",
      header: "On time · Late · Absent · Excused",
      hideOnMobile: true,
      cell: (a) => (
        <span className="text-sm">
          {a.counts.onTime} · {a.counts.late} · {a.counts.absent} · {a.counts.excused}
          <span className="block text-xs text-muted-foreground">{a.counted} meetings counted</span>
        </span>
      ),
    },
    { key: "streak", header: "Streak", align: "right", sortValue: (a) => a.streak, cell: (a) => a.streak },
    {
      key: "badges",
      header: "Badges",
      cell: (a) =>
        a.badges.length ? (
          <span className="text-sm">{a.badges.join(", ")}</span>
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      hideOnMobile: true,
      sortValue: (a) => a.serviceHours,
      cell: (a) => (a.serviceHours ? a.serviceHours : "–"),
    },
    {
      key: "target",
      header: "Spec target",
      hideOnMobile: true,
      cell: (a) => <span className="text-xs text-muted-foreground">{a.target}</span>,
    },
  ];

  return (
    <div className="min-h-dvh bg-background" data-role="admin">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="demo-pad mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <Link href="/">
            <Logo size={36} withWordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/design-system">
                <ArrowLeft aria-hidden /> Design system
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] space-y-8 px-4 py-8 outline-none sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase dark:text-gold-300">
            Phase 1 · Data, rules and logic
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-[2rem]">Demo data and rules</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            The deterministic demo unit (seed 20261106) served by the json-mock repository through{" "}
            <code className="text-sm">/api/v1/demo/summary</code>. Every number below is computed with the same{" "}
            <code className="text-sm">src/lib</code> functions the app screens will use.
          </p>
        </div>

        {/* Simulate time */}
        <GlassCard aria-labelledby="sim-title" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="sim-title" className="flex items-center gap-2 text-lg font-semibold">
                <Clock3 aria-hidden className="size-5 text-role-strong" /> Simulate time
              </h2>
              <p className="text-sm text-muted-foreground">
                Clock: <span className="tabular font-semibold text-foreground">{s?.atLabel ?? "…"}</span> (Lagos). Real
                time unless you pick a moment below; it keeps ticking from there.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActivePreset(null);
                resetClock();
              }}
            >
              <RotateCcw aria-hidden /> Back to real time
            </Button>
          </div>
          <div role="group" aria-label="Time presets" className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={activePreset === p.id}
                onClick={() => choosePreset(p.id, p.at)}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col items-start rounded-(--radius-sm) border px-3 py-1.5 text-left transition-colors",
                  activePreset === p.id ? "border-role bg-role-soft" : "border-border bg-surface hover:border-role/60",
                )}
              >
                <span className="text-sm font-semibold">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.description}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        {query.isError && !s ? (
          <ErrorState
            description={(query.error as Error).message}
            action={
              <Button variant="outline" onClick={() => query.refetch()}>
                Try again
              </Button>
            }
          />
        ) : !s ? (
          <LoadingState rows={6} label="Loading demo data" />
        ) : (
          <>
            <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label="People" value={String(s.totals.people)} icon={<Users className="size-4" />} />
              <KpiCard
                label="Average attendance"
                value={s.unit.averagePercent === null ? "–" : `${s.unit.averagePercent}%`}
                icon={<UserCheck className="size-4" />}
              />
              <KpiCard
                label="Attendance records"
                value={s.totals.records.toLocaleString("en-GB")}
                icon={<MapPin className="size-4" />}
              />
              <KpiCard
                label="Pending approvals"
                value={String(s.unit.pendingApprovals)}
                icon={<UserCheck className="size-4" />}
              />
              <KpiCard
                label="Urgent open issues"
                value={String(s.totals.urgentOpenIssues)}
                icon={<TriangleAlert className="size-4" />}
              />
              <KpiCard label="Flagged check-ins" value={String(s.totals.flagged)} icon={<Flag className="size-4" />} />
            </section>
            <p className="-mt-4 text-sm text-muted-foreground">
              {s.totals.byRole.MEMBER} members, {s.totals.byRole.VOLUNTEER} volunteers, {s.totals.byRole.ADMIN} admins ·{" "}
              {s.totals.byStatus.ACTIVE} active, {s.totals.byStatus.PENDING} pending, {s.totals.byStatus.SUSPENDED ?? 0}{" "}
              suspended · {s.unit.atRisk} at risk (below {60}% or 3 absences in a row).
            </p>

            <section aria-labelledby="accounts-title" className="space-y-3">
              <h2 id="accounts-title" className="text-xl font-semibold">
                Demo accounts{" "}
                <span className="text-sm font-normal text-muted-foreground">(password for all: Demo@2026)</span>
              </h2>
              <DataTable
                caption="Demo accounts"
                columns={columns}
                rows={s.demoAccounts}
                getRowId={(a) => a.id}
                maxHeight={640}
              />
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              <Donut
                title="Attendance records by status"
                description="Spec target: about 62% On time, 15% Late, 17% Absent, 6% Excused"
                centerValue={s.totals.records.toLocaleString("en-GB")}
                centerLabel="records"
                slices={s.distribution.map((d) => ({
                  key: d.status,
                  label: { ON_TIME: "On time", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused" }[d.status],
                  value: d.count,
                  color: {
                    ON_TIME: "var(--status-ontime)",
                    LATE: "var(--status-late)",
                    ABSENT: "var(--status-absent)",
                    EXCUSED: "var(--status-excused)",
                  }[d.status],
                }))}
              />

              <GlassCard>
                <GlassCardHeader
                  title="Next meeting at this moment"
                  description={s.next ? `${s.next.title} · ${s.next.startsLabel}` : "No upcoming meeting"}
                />
                {s.next && s.next.phase ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      <span className="font-semibold">{phaseText[s.next.phase]}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · window {s.next.opensLabel} to {s.next.closesLabel}
                      </span>
                    </p>
                    <ul className="divide-y divide-border rounded-(--radius-sm) border border-border">
                      {s.next.checkIns.map((c) => (
                        <li
                          key={c.preset}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                        >
                          <span className="font-medium">{c.preset}</span>
                          <span className="inline-flex items-center gap-2">
                            {c.distanceM !== null && (
                              <span className="tabular text-xs text-muted-foreground">
                                {c.distanceM.toLocaleString("en-GB")} m
                              </span>
                            )}
                            {c.ok ? (
                              <StatusChip status={c.status!} size="sm" />
                            ) : (
                              <StatusChip status="ABSENT" size="sm" label={c.message} />
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      Venue pin {s.venue.lat}, {s.venue.lng} · radius {s.venue.radiusM} m ·{" "}
                      {s.venue.verified ? "verified" : "not yet verified on site"}
                    </p>
                  </div>
                ) : s.next ? (
                  <p className="text-sm text-muted-foreground">
                    Tracked by attendee sheet upload; no geolocation window.
                  </p>
                ) : null}
              </GlassCard>

              <GlassCard>
                <GlassCardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Bell aria-hidden className="size-5 text-role-strong" /> Reminders due this minute
                    </span>
                  }
                  description={`${s.due.total} notification${s.due.total === 1 ? "" : "s"} due at ${s.atLabel}`}
                />
                {s.due.total === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing is due right now. Try Sat 08:25 then wait for 08:30, or pick Thu 19:30.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {Object.entries(s.due.byType).map(([t, n]) => (
                      <li key={t} className="flex justify-between gap-3">
                        <span>{typeLabel[t] ?? t}</span>
                        <span className="tabular font-semibold">{n} people</span>
                      </li>
                    ))}
                  </ul>
                )}
                <h4 className="mt-5 mb-2 text-sm font-semibold">Reminder plan, next 7 days</h4>
                <ul
                  tabIndex={0}
                  aria-label="Reminder plan for the next 7 days"
                  className="max-h-64 space-y-1 overflow-auto pr-1 text-sm"
                >
                  {s.weekPlan.map((p, i) => (
                    <li key={i} className="flex justify-between gap-3 border-b border-border/60 py-1">
                      <span>{typeLabel[p.type] ?? p.type}</span>
                      <span className="tabular shrink-0 text-muted-foreground">{p.atLabel}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>

              <GlassCard>
                <GlassCardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Upload aria-hidden className="size-5 text-role-strong" /> Upload in Preview
                    </span>
                  }
                  description={
                    s.uploadPreview
                      ? `${s.uploadPreview.name} · ${s.uploadPreview.rows} rows · Thursday 5 November`
                      : "None"
                  }
                />
                {s.uploadPreview && (
                  <div className="space-y-3 text-sm">
                    <p>
                      {s.uploadPreview.byType.EMAIL ?? 0} matched by email ·{" "}
                      {s.uploadPreview.byType.NAME_SUGGESTED ?? 0} suggested · {s.uploadPreview.byType.NOT_FOUND ?? 0}{" "}
                      not found · {s.uploadPreview.byType.DUPLICATE ?? 0} duplicate
                    </p>
                    <ul className="divide-y divide-border rounded-(--radius-sm) border border-border">
                      {s.uploadPreview.exceptions.map((e, i) => (
                        <li key={i} className="px-3 py-2.5">
                          <p className="font-medium">
                            {e.rawName}{" "}
                            <span className="font-normal text-muted-foreground">{e.rawEmail ?? "(no email)"}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.matchType === "NAME_SUGGESTED"
                              ? `Suggested: ${e.suggested} (similarity ${e.similarity})`
                              : e.matchType === "NOT_FOUND"
                                ? "Not found: no matching person"
                                : `Duplicate row of ${e.suggested ?? "an earlier row"}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </GlassCard>
            </div>

            <GlassCard>
              <GlassCardHeader title="Everything else in the seed" description="Counts per spec section 10.2" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {[
                  [
                    "Meetings",
                    `${s.totals.meetings} (${s.totals.meetingsByStatus.CLOSED ?? 0} held, ${s.totals.meetingsByStatus.CANCELLED ?? 0} cancelled, ${s.totals.meetingsByStatus.SCHEDULED ?? 0} upcoming)`,
                  ],
                  ["Manual check-ins", s.totals.manual],
                  ["Messages", s.totals.messages],
                  ["Notifications", `${s.totals.notifications} (${s.totals.unreadNotifications} unread)`],
                  [
                    "Excuse requests",
                    Object.entries(s.totals.excuses)
                      .map(([k, v]) => `${v} ${k.toLowerCase()}`)
                      .join(", "),
                  ],
                  [
                    "Issue reports",
                    Object.entries(s.totals.issues)
                      .map(([k, v]) => `${v} ${k.replace("_", " ").toLowerCase()}`)
                      .join(", "),
                  ],
                  ["Duty assignments", s.totals.duties],
                  ["Uploads", s.totals.uploads.map((u) => `${u.status.toLowerCase()}`).join(", ")],
                  ["Audit entries", s.totals.audit],
                  ["Announcements", `${s.totals.announcements} (${s.totals.pinned} pinned)`],
                  ["Badges awarded", s.totals.badgesAwarded],
                  ["Venue", s.venue.address],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </GlassCard>
          </>
        )}
      </main>
    </div>
  );
}
