"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, TooltipBody, type Series } from "./ChartFrame";

interface TrendLineProps<Row extends Record<string, unknown>> {
  title: string;
  description?: string;
  data: Row[];
  xKey: keyof Row & string;
  xLabel?: string;
  series: Series[];
  unit?: string;
  domain?: [number, number];
  height?: number;
  className?: string;
}

/** Line chart for change over time, one y-axis, 2px lines, crosshair tooltip. */
export function TrendLine<Row extends Record<string, unknown>>({
  title,
  description,
  data,
  xKey,
  xLabel = "Period",
  series,
  unit = "",
  domain,
  height = 260,
  className,
}: TrendLineProps<Row>) {
  const fmt = (v: number) => `${v.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${unit}`;
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
        <LineChart
          accessibilityLayer={false}
          data={data as Record<string, unknown>[]}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--mist)" strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey as string}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--slate-600)", fontSize: 12 }}
          />
          <YAxis
            domain={domain ?? ["auto", "auto"]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--slate-600)", fontSize: 12 }}
            tickFormatter={(v: number) => `${v}${unit}`}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "var(--slate-600)", strokeDasharray: "3 3" }}
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
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
