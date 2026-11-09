import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, ListTodo, Megaphone, Package, Pin, ShieldCheck, Users } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData } from "@/lib/member/data";
import { loadVolunteerContext } from "@/lib/volunteer/data";
import { firstName } from "@/lib/notifications/templates";
import { formatShort } from "@/lib/time/zone";
import { TITLE_LABELS } from "@/lib/repo/types";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { RsvpButtons } from "@/components/volunteer/RsvpButtons";
import { RelativeTime } from "@/components/volunteer/RelativeTime";

export const metadata: Metadata = { title: "Volunteer home" };

export default async function VolunteerHome() {
  const { user, titles } = await requirePage("/volunteer");
  const now = await serverNow();
  const [d, m] = await Promise.all([loadVolunteerContext(user, now), loadMemberData(user, now)]);
  const events = d.upcoming.slice(0, 3);
  const updates = d.updates.slice(0, 3);

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName(user.name)}`}
        subtitle={
          titles.length
            ? `Serving as ${titles.map((t) => TITLE_LABELS[t]).join(" and ")}${d.myTeam ? ` · ${d.myTeam} team` : ""}`
            : "Thank you for serving."
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/member">My member view</Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <GlassCard
            className="border-transparent bg-[linear-gradient(135deg,#0f766e_0%,#115e59_60%,#0a1a44_100%)] text-white"
            padding="lg"
          >
            <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-90">Your next duty</p>
            {d.duty && d.nextSaturday ? (
              <div className="mt-2 space-y-4">
                <div>
                  <h2 className="text-3xl font-semibold">{d.duty.zone}</h2>
                  <p className="text-white/90">
                    {formatShort(d.nextSaturday.startsAt)} (Lagos) · <RelativeTime iso={d.nextSaturday.startsAt} />
                  </p>
                  {d.duty.status === "SWAP_REQUESTED" && (
                    <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                      Swap requested: waiting for your Team Lead
                    </p>
                  )}
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <dt className="text-white/80">Arrive by</dt>
                      <dd className="font-semibold">{d.duty.arrival}</dd>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <dt className="text-white/80">Team and supervisor</dt>
                      <dd className="font-semibold">
                        {d.duty.team ?? "–"}
                        {d.duty.supervisor ? ` · ${d.duty.supervisor}` : ""}
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <ListTodo aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <dt className="text-white/80">Tasks</dt>
                      <dd className="font-semibold">{d.duty.tasks}</dd>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Package aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <dt className="text-white/80">Supplies</dt>
                      <dd className="font-semibold">{d.duty.supplies.join(", ")}</dd>
                    </div>
                  </div>
                </dl>
                <Button asChild variant="glass">
                  <Link href="/volunteer/duties">
                    Manage my duty <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <h2 className="text-2xl font-semibold">
                  No duty yet{d.nextSaturday ? ` for ${formatShort(d.nextSaturday.startsAt).split(",")[0]}` : ""}
                </h2>
                <p className="text-white/90">Pick a zone on the duty board so your Team Lead can plan the day.</p>
                <Button asChild variant="glass">
                  <Link href="/volunteer/duties">
                    Open the duty board <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            )}
          </GlassCard>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <GlassCard className="flex flex-col items-center justify-center">
              <AttendanceRing percent={m.views.overall.percent} label="Attendance" size={140} />
            </GlassCard>
            <GlassCard className="flex flex-col gap-1">
              <Clock3 aria-hidden className="size-5 text-role-strong" />
              <p className="text-sm text-muted-foreground">Service hours this month</p>
              <p className="tabular font-heading text-3xl font-semibold">{d.hours.thisMonth}</p>
              <p className="text-xs text-muted-foreground">
                {d.hours.thisYear} this year{d.hours.pending ? ` · ${d.hours.pending} waiting for verification` : ""}
              </p>
              <Link
                href="/volunteer/hours"
                className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-role-strong hover:underline"
              >
                Log or view hours
              </Link>
            </GlassCard>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <GlassCard>
            <GlassCardHeader
              title={
                <span className="flex items-center gap-2">
                  <Megaphone aria-hidden className="size-5 text-role-strong" /> Updates from the admins
                </span>
              }
              action={
                <Link
                  href="/volunteer/events"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-role-strong hover:underline"
                >
                  All updates
                </Link>
              }
            />
            <ul className="space-y-3">
              {updates.map((a) => (
                <li key={a.id} className="rounded-(--radius-md) border border-border p-3">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.pinned && <Pin aria-label="Pinned" className="size-4 text-role-strong" />}
                    {a.title}
                    {a.isNew && (
                      <span className="rounded-full bg-hod-red px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                        New
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard>
            <GlassCardHeader
              title={
                <span className="flex items-center gap-2">
                  <CalendarDays aria-hidden className="size-5 text-role-strong" /> Coming up
                </span>
              }
              action={
                <Link
                  href="/volunteer/events"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-role-strong hover:underline"
                >
                  Events
                </Link>
              }
            />
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="space-y-2 rounded-(--radius-md) border border-border p-3">
                  <div>
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatShort(e.startsAt)} (Lagos) · <RelativeTime iso={e.startsAt} />
                    </p>
                  </div>
                  <RsvpButtons meetingId={e.id} title={e.title} initial={d.rsvps[e.id]} />
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Your member features (check-in, attendance, excuses, report) are in{" "}
            <Link href="/member" className="font-medium text-role-strong underline">
              My member view
            </Link>
            .
          </span>
        </p>
      </div>
    </>
  );
}
