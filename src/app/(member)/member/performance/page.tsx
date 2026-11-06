import type { Metadata } from "next";
import { Award, CalendarCheck, Flame, Lock, Medal, Star, Timer, TrendingUp, Trophy } from "lucide-react";
import { DateTime } from "luxon";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData } from "@/lib/member/data";
import { monthlySeries } from "@/lib/attendance/aggregate";
import { BADGE_DEFS, computeBadges } from "@/lib/attendance/badges";
import type { BadgeCode } from "@/lib/repo/types";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { TrendLine } from "@/components/charts/TrendLine";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My performance" };

const BADGE_ICON: Record<BadgeCode, typeof Award> = {
  PERFECT_MONTH: CalendarCheck,
  ON_TIME_10: Timer,
  FAITHFUL_SERVANT: Trophy,
  COMEBACK: TrendingUp,
  SERVICE_STAR: Star,
};

export default async function PerformancePage() {
  const { user } = await requirePage("/member/performance");
  const now = await serverNow();
  const d = await loadMemberData(user, now);
  const hours = await repo().serviceHours.list({ where: { userId: user.id } });
  const series = monthlySeries(d.records, d.meetings, {
    approvedAt: user.approvedAt,
    now,
    lateWeight: d.settings.lateWeight,
  });
  const earned = computeBadges({
    counted: d.counted,
    hours: hours.map((h) => ({
      hours: h.hours,
      createdAt: h.createdAt,
      verified: h.source === "AUTO" || !!h.verifiedById,
    })),
    now,
    lateWeight: d.settings.lateWeight,
  });
  const chartData = series.map((p) => ({ month: `${p.label} ${p.month.slice(2, 4)}`, attendance: p.percent }));
  const sat = d.views.saturday;
  const thu = d.views.thursday;

  return (
    <>
      <PageHeader
        title="My performance"
        subtitle="How your attendance has moved over the last 12 months, and the badges you have earned."
      />
      <div className="space-y-6">
        <section aria-label="Highlights" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Medal,
              label: "Overall attendance",
              value: d.views.overall.percent === null ? "–" : `${d.views.overall.percent}%`,
              note: d.views.overall.band.label,
            },
            {
              icon: Timer,
              label: "On-time rate",
              value: d.views.overall.onTimeRate === null ? "–" : `${d.views.overall.onTimeRate}%`,
              note: "of meetings attended",
            },
            { icon: Flame, label: "Current streak", value: String(d.currentStreak), note: "meetings in a row" },
            { icon: Trophy, label: "Longest streak", value: String(d.longestStreak), note: "meetings in a row" },
          ].map(({ icon: Icon, label, value, note }) => (
            <GlassCard key={label} className="flex flex-col gap-1.5">
              <Icon aria-hidden className="size-5 text-role-strong" />
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="tabular font-heading text-3xl font-semibold">{value}</p>
              <p className="text-xs text-muted-foreground">{note}</p>
            </GlassCard>
          ))}
        </section>

        <TrendLine
          title="Monthly attendance"
          description="Percentage of counted meetings attended each month (Late counts as attended)"
          data={chartData}
          xKey="month"
          xLabel="Month"
          unit="%"
          domain={[0, 100]}
          series={[{ key: "attendance", label: "Attendance", color: "var(--series-1)" }]}
        />

        <GlassCard>
          <GlassCardHeader
            title="Saturday compared with Thursday"
            description="Saturday sanitation by check-in; Thursday prayer from the attendee sheet"
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { label: "Saturday", v: sat },
              { label: "Thursday", v: thu },
            ].map(({ label, v }) => (
              <div key={label} className="flex items-center gap-4">
                <AttendanceRing percent={v.percent} label={label} size={130} />
                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">On time</dt>
                    <dd className="tabular font-semibold">{v.counts.onTime}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Late</dt>
                    <dd className="tabular font-semibold">{v.counts.late}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Absent</dt>
                    <dd className="tabular font-semibold">{v.counts.absent}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Excused</dt>
                    <dd className="tabular font-semibold">{v.counts.excused}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </GlassCard>

        <section aria-labelledby="badges-title">
          <h2 id="badges-title" className="mb-3 text-xl font-semibold">
            Badges
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(BADGE_DEFS) as BadgeCode[]).map((code) => {
              const got = earned.find((e) => e.code === code);
              const Icon = BADGE_ICON[code];
              return (
                <li
                  key={code}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-(--radius-lg) border p-5 text-center",
                    got
                      ? "border-gold-500/60 bg-gold-100/60 shadow-soft dark:bg-gold-500/10"
                      : "border-dashed border-border bg-card opacity-80",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-14 items-center justify-center rounded-full",
                      got ? "bg-grad-gold text-navy-900" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {got ? <Icon aria-hidden className="size-7" /> : <Lock aria-hidden className="size-6" />}
                  </span>
                  <p className="font-semibold">{BADGE_DEFS[code].name}</p>
                  <p className="text-xs text-muted-foreground">{BADGE_DEFS[code].rule}</p>
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      got ? "text-gold-700 dark:text-gold-300" : "text-muted-foreground",
                    )}
                  >
                    {got
                      ? `Earned ${DateTime.fromISO(got.earnedAt).setZone("Africa/Lagos").toFormat("d LLL yyyy")}`
                      : "Not earned yet"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
