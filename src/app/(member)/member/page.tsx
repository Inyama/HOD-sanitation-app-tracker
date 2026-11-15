import { RichText } from "@/components/ui/rich-text";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarDays, Flame, Megaphone, Pin, Sparkles, Timer } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData, publicMeeting } from "@/lib/member/data";
import { lagosClock, lagosDay, typeLabel } from "@/lib/member/display";
import { firstName } from "@/lib/notifications/templates";
import { formatShort } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { StatusChip } from "@/components/attendance/StatusChip";
import { HomeHero } from "@/components/member/HomeHero";

export const metadata: Metadata = { title: "Home" };

export default async function MemberHome() {
  const { user } = await requirePage("/member");
  const now = await serverNow();
  const d = await loadMemberData(user, now);
  const r = repo();
  const [announcements, duties, zones] = await Promise.all([
    r.announcements.list({ orderBy: { field: "createdAt", dir: "desc" } }),
    r.duties.list({ where: { userId: user.id } }),
    r.zones.list(),
  ]);
  const announcement = announcements.find((a) => a.pinned) ?? announcements[0];
  const nextSaturday = d.upcoming.find((m) => m.type === "SATURDAY");
  const myDuty = nextSaturday ? duties.find((x) => x.meetingId === nextSaturday.id) : undefined;
  const dutyZone = myDuty ? zones.find((z) => z.id === myDuty.zoneId) : undefined;
  const nextThree = d.upcoming.filter((m) => m.id !== d.next?.id).slice(0, 3);
  const recent = [...d.counted].reverse().slice(0, 5);
  const recordFor = (id: string) => d.records.find((x) => x.meetingId === id);
  const nextRecord = d.next ? recordFor(d.next.id) : undefined;
  const ytd = d.views.yearToDate.counts;

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName(user.name)}`}
        subtitle={`${now.setZone(user.timezone).toFormat("cccc d LLLL")} · here is your week at a glance.`}
      />
      <div className="space-y-6">
        <HomeHero
          meeting={d.next ? publicMeeting(d.next) : null}
          venueAddress={d.venue.address}
          record={nextRecord ? { status: nextRecord.status, checkedInAt: nextRecord.checkedInAt } : null}
          isRemote={user.isRemote}
        />

        <section aria-label="Your attendance" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <GlassCard className="flex flex-col items-center justify-center gap-2">
            <AttendanceRing percent={d.views.overall.percent} label="Overall" />
            <Link
              href="/member/performance"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-role-strong hover:underline"
            >
              See my performance <ArrowRight aria-hidden className="size-4" />
            </Link>
          </GlassCard>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Timer,
                label: "On-time rate",
                value: d.views.overall.onTimeRate === null ? "–" : `${d.views.overall.onTimeRate}%`,
                note: "of meetings attended",
              },
              {
                icon: Flame,
                label: "Current streak",
                value: String(d.currentStreak),
                note: `meeting${d.currentStreak === 1 ? "" : "s"} in a row`,
              },
              {
                icon: CalendarCheck,
                label: "Attended this year",
                value: String(ytd.onTime + ytd.late),
                note: `of ${ytd.onTime + ytd.late + ytd.absent} counted`,
              },
            ].map(({ icon: Icon, label, value, note }) => (
              <GlassCard key={label} className="flex flex-col gap-1.5">
                <Icon aria-hidden className="size-5 text-role-strong" />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="tabular font-heading text-3xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{note}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <GlassCard className="lg:col-span-2">
            <GlassCardHeader
              title="Recent activity"
              description="Your last five meetings"
              action={
                <Link
                  href="/member/attendance"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-role-strong hover:underline"
                >
                  All history
                </Link>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                illustration="calendar"
                title="No meetings yet"
                description="Your first meetings will show here."
                className="py-4"
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map(({ meeting, status }) => {
                  const rec = recordFor(meeting.id);
                  const attended = status === "ON_TIME" || status === "LATE";
                  return (
                    <li key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium">{lagosDay(meeting.startsAt)}</p>
                        <p className="text-sm text-muted-foreground">{typeLabel(meeting.type)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {rec?.method === "MANUAL" && <StatusChip status="MANUAL" size="sm" />}
                        <StatusChip
                          status={status}
                          size="sm"
                          label={
                            rec?.checkedInAt && attended
                              ? `${status === "ON_TIME" ? "On time" : "Late"} · ${lagosClock(rec.checkedInAt)}`
                              : undefined
                          }
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>

          <div className="space-y-4">
            <GlassCard tone="accent">
              <GlassCardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Sparkles aria-hidden className="size-5 text-role-strong" /> Saturday zone
                  </span>
                }
              />
              {dutyZone && nextSaturday ? (
                <p>
                  You are on <span className="font-semibold">{dutyZone.name}</span> for{" "}
                  {lagosDay(nextSaturday.startsAt)}.
                  <span className="block text-sm text-muted-foreground">{dutyZone.description}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No zone assigned for the next Saturday yet. Your Team Lead will place you on the day.
                </p>
              )}
            </GlassCard>
            {announcement && (
              <GlassCard>
                <GlassCardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {announcement.pinned ? (
                        <Pin aria-hidden className="size-4 text-role-strong" />
                      ) : (
                        <Megaphone aria-hidden className="size-4 text-role-strong" />
                      )}
                      {announcement.pinned ? "Pinned announcement" : "Latest announcement"}
                    </span>
                  }
                />
                <p className="font-semibold">{announcement.title}</p>
                <RichText text={announcement.body} className="mt-1 space-y-1 text-sm text-muted-foreground" />
              </GlassCard>
            )}
          </div>
        </div>

        <GlassCard>
          <GlassCardHeader
            title="Coming up"
            description="The next three meetings and events"
            action={
              <Link
                href="/member/schedule"
                className="inline-flex min-h-11 items-center text-sm font-medium text-role-strong hover:underline"
              >
                Full schedule
              </Link>
            }
          />
          <ul className="grid gap-3 md:grid-cols-3">
            {nextThree.map((m) => (
              <li key={m.id} className="rounded-(--radius-md) border border-border p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays aria-hidden className="size-4" /> {formatShort(m.startsAt)} (Lagos)
                </p>
                <p className="mt-1 font-semibold">{m.title}</p>
                {m.statusNote && <p className="text-xs text-muted-foreground">{m.statusNote}</p>}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}
