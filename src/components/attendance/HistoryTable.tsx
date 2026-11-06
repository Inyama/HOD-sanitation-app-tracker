"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { StatusChip } from "./StatusChip";
import type { ReportRow } from "@/lib/reports/member-report";
import { cn } from "@/lib/utils";

type Period = "all" | "3m" | "year" | "custom";

interface Props {
  rows: ReportRow[];
  /** Lagos date (yyyy-mm-dd) used as "today" for period filters. */
  today: string;
}

const METHOD: Record<string, string> = { GEO: "Check-in", SHEET: "Attendee sheet", MANUAL: "Marshal" };

function shift(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Full history with filters (period, meeting type, status) and CSV export (spec 7.2). */
export function HistoryTable({ rows, today }: Props) {
  const [period, setPeriod] = React.useState<Period>("all");
  const [from, setFrom] = React.useState(shift(today, 1));
  const [to, setTo] = React.useState(today);
  const [type, setType] = React.useState<"" | ReportRow["type"]>("");
  const [status, setStatus] = React.useState<"" | ReportRow["status"]>("");

  const range: [string | null, string | null] =
    period === "all"
      ? [null, null]
      : period === "3m"
        ? [shift(today, 3), today]
        : period === "year"
          ? [`${today.slice(0, 4)}-01-01`, today]
          : [from, to];

  const filtered = rows.filter(
    (r) =>
      (!range[0] || r.date >= range[0]) &&
      (!range[1] || r.date <= range[1]) &&
      (!type || r.type === type) &&
      (!status || r.status === status),
  );

  const csv = new URLSearchParams({ format: "csv" });
  if (range[0]) csv.set("from", range[0]);
  if (range[1]) csv.set("to", range[1]);
  if (type) csv.set("type", type);

  const columns: Column<ReportRow>[] = [
    {
      key: "date",
      header: "Date",
      primary: true,
      sortValue: (r) => r.date,
      cell: (r) => <span className="font-medium">{r.dateLabel}</span>,
    },
    { key: "meeting", header: "Meeting", sortValue: (r) => r.meeting, cell: (r) => r.meeting },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      cell: (r) => (
        <span className="inline-flex flex-wrap gap-1.5">
          <StatusChip status={r.status} size="sm" />
          {r.method === "MANUAL" && <StatusChip status="MANUAL" size="sm" />}
        </span>
      ),
    },
    { key: "time", header: "Check-in time", sortValue: (r) => r.checkInTime ?? "", cell: (r) => r.checkInTime ?? "–" },
    { key: "method", header: "Method", sortValue: (r) => r.method, cell: (r) => METHOD[r.method], hideOnMobile: true },
  ];

  const select = "w-full sm:w-auto";
  return (
    <DataTable
      caption="Attendance history"
      columns={columns}
      rows={filtered}
      getRowId={(r) => r.meetingId}
      initialSort={{ key: "date", dir: "desc" }}
      maxHeight={560}
      empty={
        <EmptyState
          illustration="search"
          title="No meetings match"
          description="Try a longer period or clear the filters."
        />
      }
      toolbar={
        <div className="flex w-full flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="f-period" className="text-xs">
              Period
            </Label>
            <NativeSelect
              id="f-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className={cn(select, "h-10")}
            >
              <option value="all">All time</option>
              <option value="3m">Last 3 months</option>
              <option value="year">This year</option>
              <option value="custom">Custom dates</option>
            </NativeSelect>
          </div>
          {period === "custom" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="f-from" className="text-xs">
                  From
                </Label>
                <input
                  id="f-from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-surface px-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-to" className="text-xs">
                  To
                </Label>
                <input
                  id="f-to"
                  type="date"
                  value={to}
                  min={from}
                  max={today}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-surface px-2 text-sm"
                />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label htmlFor="f-type" className="text-xs">
              Meeting
            </Label>
            <NativeSelect
              id="f-type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className={cn(select, "h-10")}
            >
              <option value="">All meetings</option>
              <option value="SATURDAY">Saturday</option>
              <option value="THURSDAY_PRAYER">Thursday prayer</option>
              <option value="SPECIAL">Special events</option>
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-status" className="text-xs">
              Status
            </Label>
            <NativeSelect
              id="f-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={cn(select, "h-10")}
            >
              <option value="">All statuses</option>
              <option value="ON_TIME">On time</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="EXCUSED">Excused</option>
            </NativeSelect>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtered.length} meeting{filtered.length === 1 ? "" : "s"}
          </p>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <a href={`/api/v1/me/attendance?${csv.toString()}`} download>
              <Download aria-hidden /> Export CSV
            </a>
          </Button>
        </div>
      }
    />
  );
}
