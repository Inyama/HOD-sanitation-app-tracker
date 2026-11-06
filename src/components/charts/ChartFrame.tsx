"use client";

import * as React from "react";
import { Table2, ChartLine } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Series {
  key: string;
  label: string;
  color: string;
}

interface ChartFrameProps<Row extends Record<string, unknown>> {
  title: string;
  description?: string;
  series: Series[];
  data: Row[];
  /** Key in each row holding the x-axis label. */
  xKey: keyof Row & string;
  xLabel: string;
  formatValue?: (v: number) => string;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps every chart with a title, a legend (for two or more series) and a table view,
 * so identity is never colour-alone and the numbers are always available as text.
 */
export function ChartFrame<Row extends Record<string, unknown>>({
  title,
  description,
  series,
  data,
  xKey,
  xLabel,
  formatValue = (v) => v.toLocaleString("en-GB"),
  height = 260,
  className,
  children,
}: ChartFrameProps<Row>) {
  const [asTable, setAsTable] = React.useState(false);
  return (
    <section
      className={cn("rounded-(--radius-lg) border border-border bg-card p-5 shadow-soft", className)}
      aria-label={title}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground pointer-coarse:h-11"
        >
          {asTable ? <ChartLine aria-hidden className="size-4" /> : <Table2 aria-hidden className="size-4" />}
          {asTable ? "Chart" : "Table"}
        </button>
      </div>
      {series.length >= 2 && !asTable && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {asTable ? (
        <div
          tabIndex={0}
          role="region"
          aria-label={`${title} table`}
          className="overflow-auto"
          style={{ maxHeight: height + 24 }}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  {xLabel}
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-1.5 pr-3 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-t border-border/70">
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                    {String(row[xKey])}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="tabular py-1.5 pr-3 text-right">
                      {typeof row[s.key] === "number" ? formatValue(row[s.key] as number) : "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} aria-hidden>
          {children}
        </div>
      )}
    </section>
  );
}

/** Shared tooltip body: values in text ink, a colour key beside each. */
export function TooltipBody({
  label,
  items,
}: {
  label: React.ReactNode;
  items: { name: string; value: string; color: string }[];
}) {
  return (
    <div className="min-w-36 rounded-(--radius-sm) border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lift">
      <p className="mb-1 font-semibold">{label}</p>
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.name} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: it.color }} />
              {it.name}
            </span>
            <span className="tabular font-semibold">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
