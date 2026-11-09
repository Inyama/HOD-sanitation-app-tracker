import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  CalendarDays,
  Clock3,
  FileDown,
  HeartHandshake,
  MessageSquare,
  Percent,
  TriangleAlert,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { MEETING_ZONE } from "@/lib/time/zone";
import { firstName } from "@/lib/notifications/templates";
import { lagosClock, lagosDay, typeLabel } from "@/lib/member/display";
import { loadDashboard } from "@/lib/admin/data";
import { RANGE_COOKIE } from "@/lib/admin/range";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/charts/KpiCard";
import { TrendLine } from "@/components/charts/TrendLine";
import { StackedBars } from "@/components/charts/StackedBars";
import { Donut } from "@/components/charts/Donut";
import { ArrivalHeatmap } from "@/components/charts/ArrivalHeatmap";
import { AtRiskList } from "@/components/admin/AtRiskList";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

export const metadata: Metadata = { title: "Admin dashboard" };

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);

export default async function AdminDashboard() {
  const { user, actor } = await requirePage("/admin");
  const now = await serverNow();
  const d = await loadDashboard(repo(), (await cookies()).get(RANGE_COOKIE)?.value, now);
  const k = d.kpis;
  const mix = d.statusMix;
  const counted = mix.onTime + mix.late + mix.absent;

  const quick = [
    { href: "/admin/uploads", label: "Upload sheet", icon: Upload, show: can(actor, "uploads.manage") },
    { href: "/admin/messages", label: "Send message", icon: MessageSquare, show: can(actor, "messages.send") },
    { href: "/admin/members?add=1", label: "Add member", icon: UserPlus, show: can(actor, "people.manage") },
    { href: "/admin/reports", label: "Download report", icon: FileDown, show: can(actor, "reports.download") },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome, ${firstName(user.name)}. Figures for ${d.range.label.toLowerCase()}.`}
        actions={
          <div className="lg:hidden">
            <DateRangePicker
              value={d.range.value}
              label={d.range.label}
              fromDate={d.range.fromDate}
              toDate={d.range.toDate}
              today={now.setZone(MEETING_ZONE).toISODate()!}
            />
          </div>
        }
      />

      {quick.length > 0 && (
        <nav aria-label="Quick actions" className="mb-6">
          <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {quick.map((q) => (
              <li key={q.href}>
                <Button asChild variant="outline" className="w-full justify-start sm:w-auto">
                  <Link href={q.href}>
                    <q.icon aria-hidden className="text-role-strong" /> {q.label}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Active members"
          value={String(k.activeMembers.value)}
          delta={k.activeMembers.delta}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Volunteers"
          value={String(k.volunteers.value)}
          delta={k.volunteers.delta}
          icon={<HeartHandshake className="size-4" />}
        />
        <KpiCard
          label="Average attendance"
          value={pct(k.averageAttendance.value)}
          delta={k.averageAttendance.delta}
          deltaUnit=" pts"
          trend={k.averageAttendance.trend}
          icon={<Percent className="size-4" />}
        />
        <KpiCard
          label="On-time rate"
          value={pct(k.onTimeRate.value)}
          delta={k.onTimeRate.delta}
          deltaUnit=" pts"
          trend={k.onTimeRate.trend}
          icon={<Clock3 className="size-4" />}
        />
        <KpiCard
          label="Pending approvals"
          value={String(k.pendingApprovals.value)}
          delta={k.pendingApprovals.delta}
          invert
          icon={<UserCheck className="size-4" />}
        />
        <KpiCard
          label="Open issues"
          value={String(k.openIssues.value)}
          delta={k.openIssues.delta}
          invert
          icon={<TriangleAlert className="size-4" />}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5 [&>*]:min-w-0">
        <TrendLine
          className="lg:col-span-3"
          title="Attendance, last 12 weeks"
          description="Share of counted meetings attended, and the share of those arrivals that were On time"
          data={d.weeklyTrend}
          xKey="week"
          xLabel="Week starting"
          unit="%"
          domain={[0, 100]}
          series={[
            { key: "attendance", label: "Attendance", color: "var(--series-1)" },
            { key: "onTime", label: "On time", color: "var(--series-3)" },
          ]}
        />
        {counted + mix.excused === 0 ? (
          <GlassCard className="lg:col-span-2">
            <EmptyState illustration="chart" title="No meetings in this period" description="Pick a longer range." />
          </GlassCard>
        ) : (
          <Donut
            className="lg:col-span-2"
            title="On time, Late and Absent"
            description={`Counted meetings in the period${mix.excused ? `; ${mix.excused} excused are left out` : ""}`}
            centerValue={counted.toLocaleString("en-GB")}
            centerLabel="counted"
            slices={[
              { key: "ON_TIME", label: "On time", value: mix.onTime, color: "var(--status-ontime)" },
              { key: "LATE", label: "Late", value: mix.late, color: "var(--status-late)" },
              { key: "ABSENT", label: "Absent", value: mix.absent, color: "var(--status-absent)" },
            ]}
          />
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <StackedBars
          title="Saturday and Thursday"
          description="Attendance by meeting type in each part of the period"
          data={d.saturdayVsThursday}
          xKey="period"
          xLabel="Period"
          mode="grouped"
          unit="%"
          series={[
            { key: "saturday", label: "Saturday", color: "var(--series-1)" },
            { key: "thursday", label: "Thursday", color: "var(--series-2)" },
          ]}
        />
        <StackedBars
          title="Attendance by team"
          description="Highest first, for the period"
          data={d.byTeam}
          xKey="team"
          xLabel="Team"
          layout="horizontal"
          unit="%"
          height={300}
          series={[{ key: "attendance", label: "Attendance", color: "var(--series-1)" }]}
        />
      </div>

      <ArrivalHeatmap
        className="mt-4"
        title="When people arrive"
        description="Check-ins by meeting day and minutes from the start, for the period"
        columns={d.arrivals.columns}
        rows={d.arrivals.rows}
        max={d.arrivals.max}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <GlassCard>
          <GlassCardHeader
            title={`At risk (${d.atRisk.length})`}
            description={`Below ${d.settings.atRiskPercent}% overall, or ${d.settings.atRiskAbsences} absences in a row`}
          />
          <AtRiskList
            people={d.atRisk.map((p) => ({ id: p.id, name: p.name, percent: p.percent, reason: p.reason }))}
            canMessage={can(actor, "messages.send")}
          />
        </GlassCard>

        <GlassCard>
          <GlassCardHeader title="Most consistent" description="Top 10 by overall attendance (at least 8 meetings)" />
          {d.topConsistent.length === 0 ? (
            <EmptyState illustration="chart" title="Not enough meetings yet" />
          ) : (
            <ol className="divide-y divide-border" aria-label="Top 10 most consistent">
              {d.topConsistent.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="tabular w-6 text-right text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <UserAvatar name={p.name} size={30} />
                  <Link
                    href={`/admin/members/${p.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="tabular text-sm font-semibold">{pct(p.percent)}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{p.band.label}</span>
                </li>
              ))}
            </ol>
          )}
        </GlassCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <GlassCard>
          <GlassCardHeader
            title="New sign-ups"
            description="In the period"
            action={
              can(actor, "people.manage") ? (
                <Link href="/admin/approvals" className="text-sm font-medium text-role-strong hover:underline">
                  Approvals
                </Link>
              ) : undefined
            }
          />
          {d.newSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one signed up in this period.</p>
          ) : (
            <ul className="space-y-2.5">
              {d.newSignups.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <UserAvatar name={p.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/members/${p.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {p.role === "VOLUNTEER" ? "Volunteer" : "Member"} · {lagosDay(p.createdAt)}
                    </p>
                  </div>
                  {p.status === "PENDING" && (
                    <span className="rounded-full bg-(--status-late-bg) px-2 py-0.5 text-[0.6875rem] font-semibold text-(--status-late-fg)">
                      Pending
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <GlassCardHeader title="Upcoming meetings" />
          <ul className="space-y-2.5">
            {d.upcoming.map((m) => (
              <li key={m.id} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-role-soft text-role-strong"
                >
                  <CalendarDays className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabel(m.type)} · {lagosDay(m.startsAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader
            title="Recent activity"
            action={
              can(actor, "audit.view") ? (
                <Link href="/admin/audit" className="text-sm font-medium text-role-strong hover:underline">
                  Audit log
                </Link>
              ) : undefined
            }
          />
          <ul className="space-y-2.5">
            {d.activity.map((a) => (
              <li key={a.id} className="text-sm">
                <p>
                  <span className="font-semibold">{a.who}</span> {a.what.charAt(0).toLowerCase() + a.what.slice(1)}
                  {a.target && <span className="text-muted-foreground">: {a.target}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lagosDay(a.at)}, {lagosClock(a.at)}
                </p>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}
