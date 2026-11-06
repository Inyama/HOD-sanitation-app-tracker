"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, TooltipBody, type Series } from "./ChartFrame";

interface StackedBarsProps<Row extends Record<string, unknown>> {
  title: string;
  description?: string;
  data: Row[];
  xKey: keyof Row & string;
  xLabel?: string;
  series: Series[];
  /** "stacked" (default), "grouped" side by side, or horizontal bars. */
  mode?: "stacked" | "grouped";
  layout?: "vertical" | "horizontal";
  unit?: string;
  height?: number;
  className?: string;
}

/** Bars with 2px surface gaps between fills and rounded data ends. */
export function StackedBars<Row extends Record<string, unknown>>({
  title,
  description,
  data,
  xKey,
  xLabel = "Category",
  series,
  mode = "stacked",
  layout = "vertical",
  unit = "",
  height = 260,
  className,
}: StackedBarsProps<Row>) {
  const fmt = (v: number) => `${v.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${unit}`;
  const horizontal = layout === "horizontal";
  return (
    <ChartFrame
      title={title}
      description={description}
      series={series}
      data={data}
      xKey={xKey}
      xLabel={xLabel}
      formatValue={fmt}
      height={height}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer={false}
          data={data as Record<string, unknown>[]}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : 0 }}
          barGap={2}
          barCategoryGap={horizontal ? "22%" : "28%"}
        >
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--mist)" strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--slate-600)", fontSize: 12 }}
                tickFormatter={(v: number) => `${v}${unit}`}
              />
              <YAxis
                type="category"
                dataKey={xKey as string}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--slate-600)", fontSize: 12 }}
                width={96}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey as string}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--slate-600)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--slate-600)", fontSize: 12 }}
                tickFormatter={(v: number) => `${v}${unit}`}
                width={48}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBody
                  label={label}
                  items={payload.map((p) => ({
                    name: series.find((s) => s.key === p.dataKey)?.label ?? String(p.dataKey),
                    value: fmt(Number(p.value)),
                    color: String(p.color),
                  }))}
                />
              ) : null
            }
          />
          {series.map((s, i) => {
            const isTop = mode === "grouped" || i === series.length - 1;
            const r = 4;
            const radius: [number, number, number, number] = !isTop
              ? [0, 0, 0, 0]
              : horizontal
                ? [0, r, r, 0]
                : [r, r, 0, 0];
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                stackId={mode === "stacked" ? "a" : undefined}
                radius={radius}
                stroke="var(--surface)"
                strokeWidth={mode === "stacked" ? 2 : 0}
                isAnimationActive={false}
                maxBarSize={horizontal ? 22 : 36}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
