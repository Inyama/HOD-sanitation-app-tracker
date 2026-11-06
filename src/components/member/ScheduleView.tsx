"use client";

import * as React from "react";
import { DateTime } from "luxon";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, List, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatForViewer, formatShort, MEETING_ZONE } from "@/lib/time/zone";
import { isRescheduled, typeLabel } from "@/lib/member/display";
import { cn } from "@/lib/utils";

export interface ScheduleItem {
  id: string;
  type: "SATURDAY" | "THURSDAY_PRAYER" | "SPECIAL";
  title: string;
  startsAt: string;
  status: string;
  statusNote: string | null;
  method: string;
  google: string;
  outlook: string;
}

const TYPES = [
  { key: "ALL", label: "All" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "THURSDAY_PRAYER", label: "Thursday prayer" },
  { key: "SPECIAL", label: "Special events" },
] as const;

const dot: Record<ScheduleItem["type"], string> = {
  SATURDAY: "bg-royal-600",
  THURSDAY_PRAYER: "bg-gold-600",
  SPECIAL: "bg-teal-600",
};

function Markers({ m }: { m: ScheduleItem }) {
  return (
    <>
      {m.status === "CANCELLED" && (
        <span className="rounded-full bg-(--status-absent-bg) px-2 py-0.5 text-xs font-semibold text-(--status-absent-fg)">
          Cancelled
        </span>
      )}
      {isRescheduled(m.statusNote) && (
        <span className="rounded-full bg-(--status-late-bg) px-2 py-0.5 text-xs font-semibold text-(--status-late-fg)">
          Rescheduled
        </span>
      )}
    </>
  );
}

function AddToCalendar({ m }: { m: ScheduleItem }) {
  if (m.status === "CANCELLED") return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus aria-hidden /> Add to calendar
          <span className="sr-only">
            : {m.title}, {formatShort(m.startsAt)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`/api/v1/meetings/${m.id}/calendar.ics`} download>
            Download .ics (Apple, Outlook desktop)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={m.google} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={m.outlook} target="_blank" rel="noopener noreferrer">
            Outlook.com
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Schedule (spec 7.2): list and month calendar, type filter, add to calendar, cancelled and rescheduled markers. */
export function ScheduleView({
  items,
  today,
  viewerZone,
}: {
  items: ScheduleItem[];
  today: string;
  viewerZone: string;
}) {
  const [view, setView] = React.useState<"list" | "month">("list");
  const [type, setType] = React.useState<(typeof TYPES)[number]["key"]>("ALL");
  const [month, setMonth] = React.useState(() => DateTime.fromISO(today, { zone: MEETING_ZONE }).startOf("month"));
  const shown = items.filter((m) => type === "ALL" || m.type === type);
  const upcoming = shown.filter((m) => m.startsAt.slice(0, 10) >= today);
  const lagos = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }).setZone(MEETING_ZONE);

  const weeks: DateTime[][] = [];
  let cursor = month.startOf("week");
  while (cursor <= month.endOf("month").endOf("week")) {
    weeks.push(Array.from({ length: 7 }, (_, i) => cursor.plus({ days: i })));
    cursor = cursor.plus({ weeks: 1 });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Meeting type" className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={type === t.key}
              onClick={() => setType(t.key)}
              className={cn(
                "inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium pointer-coarse:h-11",
                type === t.key
                  ? "border-role bg-role-soft text-role-strong"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="View" className="inline-flex rounded-full border border-border bg-surface p-0.5">
          {(["list", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium pointer-coarse:h-11",
                view === v ? "bg-role-btn text-role-btn-fg" : "text-muted-foreground",
              )}
            >
              {v === "list" ? <List aria-hidden className="size-4" /> : <CalendarDays aria-hidden className="size-4" />}
              {v === "list" ? "List" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {view === "list" ? (
        upcoming.length === 0 ? (
          <EmptyState
            illustration="calendar"
            title="Nothing scheduled"
            description="No meetings of this type are coming up."
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((m) => (
              <li key={m.id}>
                <GlassCard
                  padding="sm"
                  className={cn("flex flex-wrap items-center gap-4", m.status === "CANCELLED" && "opacity-75")}
                >
                  <div className="flex w-16 shrink-0 flex-col items-center rounded-(--radius-md) bg-role-soft py-2 text-role-strong">
                    <span className="text-xs font-semibold uppercase">{lagos(m.startsAt).toFormat("LLL")}</span>
                    <span className="font-heading text-2xl font-semibold">{lagos(m.startsAt).toFormat("d")}</span>
                    <span className="text-xs">{lagos(m.startsAt).toFormat("ccc")}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={cn("font-semibold", m.status === "CANCELLED" && "line-through")}>{m.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatForViewer(m.startsAt, viewerZone)} · {typeLabel(m.type)}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin aria-hidden className="size-3.5" />{" "}
                      {m.method === "SHEET"
                        ? "In person or online (attendee sheet)"
                        : "At the venue (check in on arrival)"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Markers m={m} />
                      {m.statusNote && <span className="text-xs text-muted-foreground">{m.statusNote}</span>}
                    </div>
                  </div>
                  <AddToCalendar m={m} />
                </GlassCard>
              </li>
            ))}
          </ul>
        )
      ) : (
        <GlassCard padding="sm">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setMonth((m) => m.minus({ months: 1 }))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <h2 className="text-lg font-semibold" aria-live="polite">
              {month.toFormat("LLLL yyyy")}
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setMonth((m) => m.plus({ months: 1 }))}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
            <caption className="sr-only">Meetings in {month.toFormat("LLLL yyyy")}</caption>
            <thead>
              <tr>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <th key={d} scope="col" className="text-xs font-semibold text-muted-foreground">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day) => {
                    const dayItems = shown.filter((m) => lagos(m.startsAt).hasSame(day, "day"));
                    const inMonth = day.month === month.month;
                    const isToday = day.toISODate() === today;
                    return (
                      <td
                        key={day.toISODate()}
                        className={cn(
                          "h-20 rounded-(--radius-sm) border align-top",
                          inMonth ? "border-border bg-surface" : "border-transparent bg-muted/40 text-muted-foreground",
                          isToday && "ring-2 ring-role",
                        )}
                      >
                        <div className="p-1">
                          <span className={cn("text-xs font-semibold", isToday && "text-role-strong")}>
                            {day.day}
                            {isToday && <span className="sr-only"> (today)</span>}
                          </span>
                          <ul className="mt-0.5 space-y-0.5">
                            {dayItems.map((m) => (
                              <li
                                key={m.id}
                                className={cn(
                                  "flex items-center gap-1 truncate text-[0.6875rem] leading-tight",
                                  m.status === "CANCELLED" && "line-through opacity-70",
                                )}
                              >
                                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot[m.type])} />
                                <span className="truncate">
                                  {lagos(m.startsAt).toFormat("H:mm")}{" "}
                                  {m.type === "SATURDAY"
                                    ? "Sanitation"
                                    : m.type === "THURSDAY_PRAYER"
                                      ? "Prayer"
                                      : m.title}
                                  {m.status === "CANCELLED" && " (cancelled)"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-royal-600" /> Saturday sanitation
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-gold-600" /> Thursday prayer
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-teal-600" /> Special event
            </li>
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
