"use client";

import * as React from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
import { MEETING_ZONE } from "@/lib/time/zone";

export type HeatStatus = "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED" | "CANCELLED" | "NONE";

export interface HeatCell {
  /** ISO start of the meeting (UTC). */
  date: string;
  meetingName: string;
  /** Row the cell sits in, e.g. "Sat" or "Thu". */
  row: string;
  status: HeatStatus;
}

const styles: Record<HeatStatus, { label: string; fill: string; mark: React.ReactNode }> = {
  ON_TIME: { label: "On time", fill: "var(--status-ontime)", mark: null },
  LATE: {
    label: "Late",
    fill: "var(--status-late)",
    mark: <circle cx="7" cy="7" r="2.2" fill="white" />,
  },
  ABSENT: {
    label: "Absent",
    fill: "var(--status-absent)",
    mark: <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />,
  },
  EXCUSED: {
    label: "Excused",
    fill: "var(--status-excused)",
    mark: <path d="M4 7.2l2 2 4-4.4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />,
  },
  CANCELLED: {
    label: "Cancelled",
    fill: "transparent",
    mark: <path d="M3.5 10.5l7-7" stroke="var(--slate-600)" strokeWidth="1.4" strokeLinecap="round" />,
  },
  NONE: { label: "No record", fill: "var(--status-none)", mark: null },
};

interface HeatmapProps {
  cells: HeatCell[];
  rows?: string[];
  title?: string;
  className?: string;
}

/**
 * Spec 3.5: 12 months by week, one square per meeting, coloured by status (plus a glyph so
 * colour is never the only signal), tooltip with date and status, keyboard focusable.
 * Uses a single tab stop with arrow-key navigation (roving tabindex).
 */
export function Heatmap({ cells, rows = ["Thu", "Sat"], title = "Attendance heatmap", className }: HeatmapProps) {
  const weeks = React.useMemo(() => {
    const byWeek = new Map<string, Map<string, HeatCell>>();
    for (const cell of cells) {
      const d = DateTime.fromISO(cell.date, { zone: "utc" }).setZone(MEETING_ZONE);
      const wk = d.startOf("week").toISODate()!;
      if (!byWeek.has(wk)) byWeek.set(wk, new Map());
      byWeek.get(wk)!.set(cell.row, cell);
    }
    return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [cells]);

  const [active, setActive] = React.useState<{ w: number; r: number }>({
    w: Math.max(0, weeks.length - 1),
    r: rows.length - 1,
  });
  const [announce, setAnnounce] = React.useState<HeatCell | null>(null);
  const refs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const focusCell = (w: number, r: number) => {
    const clampedW = Math.min(weeks.length - 1, Math.max(0, w));
    const clampedR = Math.min(rows.length - 1, Math.max(0, r));
    setActive({ w: clampedW, r: clampedR });
    refs.current.get(`${clampedW}:${clampedR}`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, w: number, r: number) => {
    const map: Record<string, [number, number]> = {
      ArrowRight: [w + 1, r],
      ArrowLeft: [w - 1, r],
      ArrowDown: [w, r + 1],
      ArrowUp: [w, r - 1],
      Home: [0, r],
      End: [weeks.length - 1, r],
    };
    const next = map[e.key];
    if (next) {
      e.preventDefault();
      focusCell(next[0], next[1]);
    }
  };

  const monthLabels = weeks.map(([wk], i) => {
    const d = DateTime.fromISO(wk);
    const prev = i > 0 ? DateTime.fromISO(weeks[i - 1][0]) : null;
    return !prev || prev.month !== d.month ? d.toFormat("LLL") : "";
  });

  const describe = (c: HeatCell) => {
    const d = DateTime.fromISO(c.date, { zone: "utc" }).setZone(MEETING_ZONE);
    return `${d.toFormat("ccc d LLL yyyy")}, ${c.meetingName}: ${styles[c.status].label}`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto pb-1">
        <div
          role="grid"
          aria-label={title}
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `2.25rem repeat(${weeks.length}, 14px)` }}
        >
          <div role="row" className="contents">
            <span role="columnheader" className="sr-only">
              Meeting
            </span>
            {monthLabels.map((m, i) => (
              <span
                key={i}
                role="columnheader"
                aria-hidden={!m}
                className="h-4 text-[0.625rem] leading-4 whitespace-nowrap text-muted-foreground"
              >
                {m}
              </span>
            ))}
          </div>
          {rows.map((rowName, r) => (
            <div role="row" key={rowName} className="contents">
              <span role="rowheader" className="pr-1 text-[0.6875rem] leading-[14px] text-muted-foreground">
                {rowName}
              </span>
              {weeks.map(([wk, map], w) => {
                const cell = map.get(rowName);
                const isActive = active.w === w && active.r === r;
                if (!cell) return <span key={wk} role="gridcell" aria-label="No meeting" className="size-3.5" />;
                const s = styles[cell.status];
                return (
                  <span role="gridcell" key={wk} className="size-3.5">
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) refs.current.set(`${w}:${r}`, el);
                      }}
                      tabIndex={isActive ? 0 : -1}
                      aria-label={describe(cell)}
                      onKeyDown={(e) => onKeyDown(e, w, r)}
                      onFocus={() => {
                        setActive({ w, r });
                        setAnnounce(cell);
                      }}
                      onMouseEnter={() => setAnnounce(cell)}
                      className="group relative block size-3.5 cursor-default rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-1"
                    >
                      <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden>
                        <rect
                          x="0.5"
                          y="0.5"
                          width="13"
                          height="13"
                          rx="3"
                          fill={s.fill}
                          stroke={cell.status === "CANCELLED" ? "var(--slate-600)" : "none"}
                          strokeDasharray={cell.status === "CANCELLED" ? "2 1.5" : undefined}
                        />
                        {s.mark}
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {announce ? describe(announce) : "Hover or use the arrow keys to see each meeting."}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {(["ON_TIME", "LATE", "ABSENT", "EXCUSED", "CANCELLED"] as const).map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden>
              <rect
                x="0.5"
                y="0.5"
                width="13"
                height="13"
                rx="3"
                fill={styles[k].fill}
                stroke={k === "CANCELLED" ? "var(--slate-600)" : "none"}
                strokeDasharray={k === "CANCELLED" ? "2 1.5" : undefined}
              />
              {styles[k].mark}
            </svg>
            {styles[k].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
