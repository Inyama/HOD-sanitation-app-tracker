"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Flag, Hourglass, Radio, Search, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusChip } from "@/components/attendance/StatusChip";
import { lagosClock } from "@/lib/member/display";
import type { LiveBoardData } from "@/lib/admin/ops-live";
import { cn } from "@/lib/utils";

const LiveMap = dynamic(() => import("./LiveMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" aria-hidden />,
});

const PHASE: Record<string, { text: string; live: boolean }> = {
  BEFORE: { text: "Check-in has not opened yet", live: false },
  OPEN_ON_TIME: { text: "Check-in is open: arrivals are On time", live: true },
  OPEN_LATE: { text: "Check-in is open: arrivals now count as Late", live: true },
  CLOSED: { text: "Check-in has closed", live: false },
};

type Filter = "ALL" | "ON_TIME" | "LATE" | "NOT_YET" | "FLAGGED";

/** Live Saturday board (spec 7.4 item 2): counters, map, live list refreshed every 5 s in demo. */
export function LiveBoard({ initial, demo }: { initial: LiveBoardData; demo: boolean }) {
  const [meetingId, setMeetingId] = React.useState(initial.meeting?.id ?? "");
  const [team, setTeam] = React.useState("ALL");
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [q, setQ] = React.useState("");

  const query = useQuery({
    queryKey: ["admin-live", meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/admin/live${meetingId ? `?meetingId=${encodeURIComponent(meetingId)}` : ""}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Could not load the live board");
      return (await res.json()) as LiveBoardData;
    },
    initialData: meetingId === initial.meeting?.id ? initial : undefined,
    refetchInterval: (qq) => {
      const live = PHASE[qq.state.data?.meeting?.phase ?? "CLOSED"]?.live;
      return live ? (demo ? 5000 : 15000) : 60000;
    },
  });
  const d = query.data;

  if (query.isError && !d)
    return (
      <ErrorState
        description="The live board could not be loaded."
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  if (!d)
    return (
      <div
        className="h-96 animate-pulse rounded-(--radius-lg) bg-muted"
        aria-busy="true"
        aria-label="Loading the live board"
      />
    );
  if (!d.meeting)
    return (
      <GlassCard>
        <EmptyState
          illustration="calendar"
          title="No check-in meeting nearby"
          description="The board shows a Saturday or event from two weeks before to two weeks after today."
          action={
            <Link href="/admin/meetings" className="font-semibold text-role-strong underline-offset-4 hover:underline">
              Open meetings
            </Link>
          }
        />
      </GlassCard>
    );

  const m = d.meeting;
  const phase = PHASE[m.phase] ?? PHASE.CLOSED;
  const people = (d.people ?? []).filter((p) => team === "ALL" || p.teamId === team);
  const counts = {
    expected: people.length,
    onTime: people.filter((p) => p.state === "ON_TIME").length,
    late: people.filter((p) => p.state === "LATE").length,
    notYet: people.filter((p) => p.state === "NOT_YET").length,
    flagged: people.filter((p) => p.flagged).length,
  };
  const needle = q.trim().toLowerCase();
  const shown = people
    .filter((p) => (filter === "ALL" ? true : filter === "FLAGGED" ? p.flagged : p.state === filter))
    .filter((p) => !needle || p.name.toLowerCase().includes(needle))
    .sort((a, b) => Number(b.flagged) - Number(a.flagged));
  const teamName = new Map((d.teams ?? []).map((t) => [t.id, t.name]));
  const dots = (d.dots ?? []).filter((x) => team === "ALL" || x.teamId === team);

  const tiles: { key: Filter; label: string; value: number; icon: typeof Users }[] = [
    { key: "ALL", label: "Expected", value: counts.expected, icon: Users },
    { key: "ON_TIME", label: "Present on time", value: counts.onTime, icon: UserCheck },
    { key: "LATE", label: "Late", value: counts.late, icon: Clock3 },
    { key: "NOT_YET", label: "Not yet", value: counts.notYet, icon: Hourglass },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">
            Meeting
            <NativeSelect value={m.id} onChange={(e) => setMeetingId(e.target.value)}>
              {d.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title},{" "}
                  {new Date(o.startsAt).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "Africa/Lagos",
                  })}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            Team
            <NativeSelect value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="ALL">All teams</option>
              {(d.teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <p
          className={cn(
            "inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-sm font-semibold sm:self-auto",
            phase.live ? "bg-(--status-ontime-bg) text-(--status-ontime-fg)" : "bg-muted text-muted-foreground",
          )}
          aria-live="polite"
        >
          <Radio aria-hidden className={cn("size-4", phase.live && "motion-safe:animate-pulse")} />
          {phase.text}
          {phase.live && <span className="font-normal">· refreshes every {demo ? 5 : 15} s</span>}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => setFilter(t.key)}
              aria-pressed={filter === t.key}
              className={cn(
                "w-full rounded-(--radius-lg) border bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-(--sky-400)",
                filter === t.key ? "border-role ring-2 ring-role/40" : "border-border",
              )}
            >
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <t.icon aria-hidden className="size-4" /> {t.label}
              </span>
              <span className="tabular mt-1 block font-heading text-3xl font-semibold">{t.value}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-5 [&>*]:min-w-0">
        <GlassCard padding="none" className="overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Check-ins on the map</h2>
            <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="size-2.5 rounded-full bg-(--success)" /> On time
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="size-2.5 rounded-full bg-(--warning)" /> Late
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="size-2.5 rounded-full border-2 border-(--danger)" /> Flagged
              </span>
            </p>
          </div>
          {d.venue ? (
            <div
              role="region"
              aria-label={`Map of ${dots.length} check-ins around ${d.venue.name}. The list beside it has the same people.`}
              className="relative isolate z-0 h-80 lg:h-[28rem]"
            >
              <LiveMap venue={d.venue} dots={dots} />
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Set the venue pin in Settings to see the map.</p>
          )}
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {dots.length} {dots.length === 1 ? "check-in" : "check-ins"} with a location
            {d.excused ? ` · ${d.excused} excused` : ""} · updated {lagosClock(d.at)} (Lagos)
          </p>
        </GlassCard>

        <section
          aria-labelledby="live-list"
          className="rounded-(--radius-lg) border border-border bg-card shadow-soft lg:col-span-2"
        >
          <div className="space-y-3 border-b border-border px-4 py-3">
            <h2 id="live-list" className="flex items-center justify-between text-base font-semibold">
              Live list <span className="tabular rounded-full bg-muted px-2 text-sm">{shown.length}</span>
            </h2>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name"
                aria-label="Search the live list"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
              {(["ALL", "ON_TIME", "LATE", "NOT_YET", "FLAGGED"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs font-semibold",
                    filter === f ? "border-role bg-role/10 text-role-strong" : "border-border text-muted-foreground",
                  )}
                >
                  {
                    {
                      ALL: "Everyone",
                      ON_TIME: "On time",
                      LATE: "Late",
                      NOT_YET: "Not yet",
                      FLAGGED: `Flagged (${counts.flagged})`,
                    }[f]
                  }
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nobody matches.</p>
          ) : (
            <ul tabIndex={0} aria-label="People" className="max-h-[28rem] divide-y divide-border overflow-auto">
              {shown.map((p) => (
                <li
                  key={p.userId}
                  className={cn("flex items-center gap-3 px-4 py-2.5", p.flagged && "bg-(--status-absent-bg)/40")}
                >
                  <UserAvatar name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.teamId ? (teamName.get(p.teamId) ?? "") : "No team"}
                      {p.distanceM !== null ? ` · ${p.distanceM} m away` : ""}
                      {p.flagReason ? ` · ${p.flagReason}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {p.state === "NOT_YET" ? (
                      <StatusChip status="PENDING" label="Not yet" size="sm" />
                    ) : (
                      <StatusChip
                        status={p.state}
                        size="sm"
                        label={`${p.state === "LATE" ? "Late" : "On time"} · ${lagosClock(p.checkedInAt) ?? ""}`}
                      />
                    )}
                    {p.flagged && <StatusChip status="FLAGGED" size="sm" />}
                    {p.method === "MANUAL" && !p.flagged && <StatusChip status="MANUAL" size="sm" />}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {counts.flagged > 0 && (
            <p className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs">
              <Flag aria-hidden className="size-3.5 text-(--status-absent-fg)" />
              Flagged check-ins wait in{" "}
              <Link
                href="/admin/corrections"
                className="font-semibold text-role-strong underline-offset-4 hover:underline"
              >
                Corrections
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
