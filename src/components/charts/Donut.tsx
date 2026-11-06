"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { TooltipBody } from "./ChartFrame";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  title: string;
  description?: string;
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

/**
 * Part-to-whole donut. The legend lists every slice with its value and share,
 * so the chart is readable without colour.
 */
export function Donut({ title, description, slices, centerLabel, centerValue, className }: DonutProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const pct = (v: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : "0%");
  return (
    <section
      className={cn("rounded-(--radius-lg) border border-border bg-card p-5 shadow-soft", className)}
      aria-label={title}
    >
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 grid items-center gap-4 sm:grid-cols-[180px_1fr]">
        <div className="relative mx-auto size-[180px]" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                rootTabIndex={-1}
                innerRadius={58}
                outerRadius={86}
                paddingAngle={1.5}
                stroke="var(--surface)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBody
                      label={String(payload[0].name)}
                      items={[
                        {
                          name: "Share",
                          value: `${Number(payload[0].value).toLocaleString("en-GB")} (${pct(Number(payload[0].value))})`,
                          color: String(payload[0].payload.color),
                        },
                      ]}
                    />
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          {(centerValue || centerLabel) && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {centerValue && <span className="tabular font-heading text-2xl font-semibold">{centerValue}</span>}
              {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
            </div>
          )}
        </div>
        <ul className="space-y-2 text-sm">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="tabular text-muted-foreground">
                <span className="font-semibold text-foreground">{s.value.toLocaleString("en-GB")}</span> ·{" "}
                {pct(s.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
