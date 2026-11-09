"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RANGE_COOKIE, RANGE_PRESETS, encodeCustomRange } from "@/lib/admin/range";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  value: string;
  label: string;
  fromDate: string;
  toDate: string;
  /** Lagos date of "today", the latest day that can be picked. */
  today: string;
  className?: string;
}

const MAX_AGE = 60 * 60 * 24 * 180;

function saveRange(v: string) {
  document.cookie = `${RANGE_COOKIE}=${encodeURIComponent(v)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

/**
 * Global admin date range (spec 7.4 shell). The choice is saved in a cookie so the dashboard
 * cards and reports on every admin page use the same period; the server re-reads it on refresh.
 */
export function DateRangePicker({ value, label, fromDate, toDate, today, className }: DateRangePickerProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(fromDate);
  const [to, setTo] = React.useState(toDate);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const apply = (v: string) => {
    saveRange(v);
    setOpen(false);
    startTransition(() => router.refresh());
  };

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError("Choose both dates.");
    if (to < from) return setError("The end date must be on or after the start date.");
    if (from > today) return setError("The start date cannot be in the future.");
    setError(null);
    apply(encodeCustomRange(from, to));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setFrom(fromDate);
          setTo(toDate);
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-10 gap-2 rounded-full", className)} aria-busy={pending}>
          <CalendarRange aria-hidden className="size-4 text-role-strong" />
          <span className="sr-only">Date range: </span>
          <span className="max-w-[16rem] truncate">{label}</span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-3">
        <p className="px-1 text-sm font-semibold">Date range for dashboard and reports</p>
        <ul className="grid grid-cols-2 gap-1.5" aria-label="Preset ranges">
          {RANGE_PRESETS.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => apply(p.key)}
                aria-pressed={value === p.key}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center justify-between gap-1 rounded-(--radius-sm) border px-2.5 text-left text-sm",
                  value === p.key
                    ? "border-role bg-role-soft font-semibold text-role-strong"
                    : "border-border hover:bg-muted",
                )}
              >
                {p.label}
                {value === p.key && <Check aria-hidden className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={applyCustom} noValidate className="space-y-2 border-t border-border pt-3">
          <p className="px-1 text-sm font-medium">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="range-from" className="text-xs">
                From
              </Label>
              <Input id="range-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="range-to" className="text-xs">
                To
              </Label>
              <Input id="range-to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-xs text-(--status-absent-fg)">
              {error}
            </p>
          )}
          <Button type="submit" variant="role" size="sm" className="w-full">
            Apply custom range
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
