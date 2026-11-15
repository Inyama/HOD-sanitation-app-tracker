import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowDown, ArrowUp, Minus, TrendingDown, Trophy } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { RANGE_COOKIE } from "@/lib/admin/range";
import { loadAnalytics } from "@/lib/admin/ops-reports";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendLine } from "@/components/charts/TrendLine";
import { StackedBars } from "@/components/charts/StackedBars";

export const metadata: Metadata = { title: "Analytics" };

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);
const TYPES = ["ALL", "SATURDAY", "THURSDAY_PRAYER", "SPECIAL"] as const;

function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">–</span>;
  const Icon = v > 0 ? ArrowUp : v < 0 ? ArrowDown : Minus;
  return (
    <span
      className={v > 0 ? "text-(--status-ontime-fg)" : v < 0 ? "text-(--status-absent-fg)" : "text-muted-foreground"}
    >
      <Icon aria-hidden className="inline size-3.5" /> {v > 0 ? "+" : ""}
      {v} points
    </span>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requirePage("/admin/analytics");
  const now = await serverNow();
  const sp = await searchParams;
  const meetingType = TYPES.find((t) => t === sp.meetingType) ?? "ALL";
  const teamId = typeof sp.teamId === "string" ? sp.teamId : "ALL";
  const a = await loadAnalytics(repo(), now, (await cookies()).get(RANGE_COOKIE)?.value, { meetingType, teamId });

  return (
    <>
      <PageHeader
        title="Performance analytics"
        subtitle={`Cohorts, punctuality, drop-off and teams for ${a.range.label.toLowerCase()}. Change the period in the top bar.`}
      />

      <form method="get" className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end" aria-label="Filters">
        <label className="space-y-1.5 text-sm font-medium sm:w-56">
          Meetings
          <NativeSelect name="meetingType" defaultValue={meetingType}>
            <option value="ALL">All meetings</option>
            <option value="SATURDAY">Saturday only</option>
            <option value="THURSDAY_PRAYER">Thursday prayer only</option>
            <option value="SPECIAL">Special events only</option>
          </NativeSelect>
        </label>
        <label className="space-y-1.5 text-sm font-medium sm:w-56">
          Team
          <NativeSelect name="teamId" defaultValue={teamId}>
            <option value="ALL">All teams</option>
            {a.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" variant="role">
          Apply
        </Button>
        {(meetingType !== "ALL" || teamId !== "ALL") && (
          <Link
            href="/admin/analytics"
            className="text-sm font-semibold text-role-strong underline-offset-4 hover:underline sm:self-center"
          >
            Clear filters
          </Link>
        )}
      </form>

      <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <TrendLine
          title="Punctuality trend"
          description="On-time rate among people who came."
          data={a.punctuality.map((p) => ({ period: p.period, onTime: p.onTime ?? 0 }))}
          xKey="period"
          series={[{ key: "onTime", label: "On-time rate", color: "var(--series-1)" }]}
          unit="%"
          domain={[0, 100]}
        />
        <TrendLine
          title="Average arrival"
          description="Minutes after the start (negative is early). Check-ins with a time only."
          data={a.punctuality.map((p) => ({ period: p.period, minutes: p.averageArrival ?? 0 }))}
          xKey="period"
          series={[{ key: "minutes", label: "Minutes after start", color: "var(--series-2)" }]}
          unit=" min"
        />

        <GlassCard className="space-y-4 xl:col-span-2">
          <GlassCardHeader
            title="Cohorts by approval month"
            description="How each month's new people attend: in their first three months, and overall."
          />
          {a.cohorts.length === 0 ? (
            <EmptyState
              illustration="chart"
              title="No new people in the last 12 months"
              description="Cohorts appear as people are approved."
            />
          ) : (
            <>
              <StackedBars
                title="Attendance by cohort"
                data={a.cohorts.map((c) => ({
                  cohort: c.cohort,
                  first: c.firstThreeMonths ?? 0,
                  overall: c.overall ?? 0,
                }))}
                xKey="cohort"
                xLabel="Cohort"
                mode="grouped"
                unit="%"
                series={[
                  { key: "first", label: "First 3 months", color: "var(--series-1)" },
                  { key: "overall", label: "Overall", color: "var(--series-3)" },
                ]}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <caption className="sr-only">Cohort details</caption>
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2 font-semibold">
                        Cohort
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        People
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        Still active
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        First 3 months
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        Overall
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular divide-y divide-border">
                    {a.cohorts.map((c) => (
                      <tr key={c.cohort}>
                        <th scope="row" className="py-2 text-left font-medium">
                          {c.cohort}
                        </th>
                        <td className="py-2 text-right">{c.size}</td>
                        <td className="py-2 text-right">{c.stillActive}</td>
                        <td className="py-2 text-right">{pct(c.firstThreeMonths)}</td>
                        <td className="py-2 text-right">{pct(c.overall)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <GlassCardHeader
            title="Drop-off"
            description="Active people whose last 30 days are 20 points or more below the three months before."
          />
          {a.dropping.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown aria-hidden className="size-4" /> Nobody has dropped off sharply.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-(--radius-md) border border-border">
              {a.dropping.slice(0, 12).map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Link href={`/admin/members/${d.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {d.name}
                  </Link>
                  <span className="tabular text-muted-foreground">
                    {pct(d.before)} → {pct(d.recent)}
                  </span>
                  <Change v={d.change} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <StackedBars
          title="Last four Saturdays"
          description="How many of the last four Saturdays each in-person member came to."
          data={a.distribution}
          xKey="attended"
          xLabel="Attended"
          series={[{ key: "people", label: "People", color: "var(--series-1)" }]}
        />

        <GlassCard className="space-y-4 xl:col-span-2">
          <GlassCardHeader
            title="Team leaderboard"
            description="Attendance in the period, change versus the previous period, punctuality and verified service hours."
          />
          {a.leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">Team leaderboard</caption>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 font-semibold">
                      #
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      Team
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      People
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Attendance
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Change
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      On-time rate
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-border">
                  {a.leaderboard.map((t, i) => (
                    <tr key={t.team}>
                      <td className="py-2">
                        {i === 0 ? <Trophy aria-label="First" className="size-4 text-gold-600" /> : i + 1}
                      </td>
                      <th scope="row" className="py-2 text-left font-medium">
                        {t.team}
                      </th>
                      <td className="py-2 text-right">{t.people}</td>
                      <td className="py-2 text-right font-semibold">{pct(t.attendance)}</td>
                      <td className="py-2 text-right text-xs">
                        <Change v={t.change} />
                      </td>
                      <td className="py-2 text-right">{pct(t.onTime)}</td>
                      <td className="py-2 text-right">{t.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}
