import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Flame, Timer } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { attendanceViews, countedMeetings, currentStreak } from "@/lib/attendance/aggregate";
import { nextMeeting, withRecurringMeetings } from "@/lib/time/schedule";
import { formatShort } from "@/lib/time/zone";
import { serverNow } from "@/lib/time/server-now";
import { firstName } from "@/lib/notifications/templates";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Home" };

export default async function MemberHome() {
  const { user } = await requirePage("/member");
  const r = repo();
  const [records, meetings] = await Promise.all([
    r.records.list({ where: { userId: user.id } }),
    r.meetings.list({ orderBy: { field: "startsAt" } }),
  ]);
  const now = serverNow();
  const views = attendanceViews(records, meetings, { approvedAt: user.approvedAt, now });
  const streak = currentStreak(countedMeetings(records, meetings, { approvedAt: user.approvedAt, now }));
  const next = nextMeeting(withRecurringMeetings(meetings, now), now);

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName(user.name)}`}
        subtitle="You are signed in. Your full dashboard with check-in arrives in Phase 3."
        actions={
          <Button asChild variant="role">
            <Link href="/member/check-in">Check in</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <GlassCard className="flex flex-col items-center justify-center">
          <AttendanceRing percent={views.overall.percent} label="Overall" />
        </GlassCard>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Timer,
              label: "On-time rate",
              value: views.overall.onTimeRate === null ? "–" : `${views.overall.onTimeRate}%`,
            },
            { icon: Flame, label: "Current streak", value: `${streak} meeting${streak === 1 ? "" : "s"}` },
            {
              icon: CalendarDays,
              label: "Attended this year",
              value: String(views.yearToDate.counts.onTime + views.yearToDate.counts.late),
            },
          ].map(({ icon: Icon, label, value }) => (
            <GlassCard key={label} className="flex flex-col gap-2">
              <Icon aria-hidden className="size-5 text-role-strong" />
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="tabular font-heading text-2xl font-semibold">{value}</p>
            </GlassCard>
          ))}
          {next && (
            <GlassCard className="sm:col-span-3">
              <p className="text-sm text-muted-foreground">Next meeting</p>
              <p className="font-semibold">
                {next.title} · {formatShort(next.startsAt)} (Lagos)
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </>
  );
}
