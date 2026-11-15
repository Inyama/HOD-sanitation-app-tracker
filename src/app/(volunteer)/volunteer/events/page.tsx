import { RichText } from "@/components/ui/rich-text";
import type { Metadata } from "next";
import { CalendarPlus, MapPin, Megaphone, Pin, Users } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { loadVolunteerContext } from "@/lib/volunteer/data";
import { buildDutyBoard } from "@/lib/volunteer/duties";
import { formatForViewer } from "@/lib/time/zone";
import { isRescheduled, typeLabel } from "@/lib/member/display";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { RsvpButtons } from "@/components/volunteer/RsvpButtons";
import { RelativeTime } from "@/components/volunteer/RelativeTime";

export const metadata: Metadata = { title: "Events and schedule" };

const EVENT_VOLUNTEERS = 20;

export default async function EventsPage() {
  const { user } = await requirePage("/volunteer/events");
  const now = await serverNow();
  const d = await loadVolunteerContext(user, now);
  const r = repo();
  const [zones, duties, rsvps, venues] = await Promise.all([
    r.zones.list(),
    r.duties.list(),
    r.rsvps.list(),
    r.venues.list(),
  ]);
  const venue = venues[0];
  const items = d.upcoming.slice(0, 10).map((m) => {
    let needed: number | null = null;
    if (m.type === "SATURDAY") needed = buildDutyBoard(zones, duties, m.id, user.id).reduce((s, z) => s + z.open, 0);
    else if (m.type === "SPECIAL")
      needed = Math.max(0, EVENT_VOLUNTEERS - rsvps.filter((x) => x.meetingId === m.id && x.answer === "GOING").length);
    return { ...m, needed, going: rsvps.filter((x) => x.meetingId === m.id && x.answer === "GOING").length };
  });

  return (
    <>
      <PageHeader
        title="Events and schedule"
        subtitle="Updates from the admins, and what is coming up. RSVP so leaders can plan."
      />
      <div className="space-y-6">
        <section aria-labelledby="updates-title" className="space-y-3">
          <h2 id="updates-title" className="flex items-center gap-2 text-xl font-semibold">
            <Megaphone aria-hidden className="size-5 text-role-strong" /> Updates
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {d.updates.map((a) => (
              <li key={a.id}>
                <GlassCard padding="sm" tone={a.pinned ? "accent" : "light"} className="h-full space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.pinned && <Pin aria-label="Pinned" className="size-4 text-role-strong" />}
                    {a.title}
                    {a.isNew && (
                      <span className="rounded-full bg-hod-red px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                        New
                      </span>
                    )}
                  </p>
                  <RichText text={a.body} className="text-sm" />
                  <p className="text-xs text-muted-foreground">
                    {a.author} · {formatForViewer(a.createdAt, user.timezone)}
                  </p>
                </GlassCard>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="upcoming-title" className="space-y-3">
          <h2 id="upcoming-title" className="text-xl font-semibold">
            Upcoming meetings and events
          </h2>
          <ul className="space-y-3">
            {items.map((m) => (
              <li key={m.id}>
                <GlassCard padding="sm" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold tracking-wide text-role-strong uppercase">
                      {typeLabel(m.type)}
                    </p>
                    <p className="text-lg font-semibold">{m.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatForViewer(m.startsAt, user.timezone)} · <RelativeTime iso={m.startsAt} />
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin aria-hidden className="size-4 shrink-0" />{" "}
                      {m.method === "SHEET" ? "In person or online" : venue?.address}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {m.needed !== null && (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Users aria-hidden className="size-4" />{" "}
                          {m.needed === 0
                            ? "Fully staffed"
                            : `${m.needed} volunteer${m.needed === 1 ? "" : "s"} needed`}
                        </span>
                      )}
                      <span className="text-muted-foreground">{m.going} going</span>
                      {isRescheduled(m.statusNote) && (
                        <span className="rounded-full bg-(--status-late-bg) px-2 py-0.5 text-xs font-semibold text-(--status-late-fg)">
                          {m.statusNote}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end">
                    <RsvpButtons meetingId={m.id} title={m.title} initial={d.rsvps[m.id]} />
                    <Button asChild variant="ghost" size="sm">
                      <a href={`/api/v1/meetings/${m.id}/calendar.ics`} download>
                        <CalendarPlus aria-hidden /> Add to calendar<span className="sr-only">: {m.title}</span>
                      </a>
                    </Button>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
