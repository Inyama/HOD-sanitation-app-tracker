import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

interface KpiCardProps {
  label: string;
  value: string;
  /** Change versus previous period (same unit as value, e.g. points or people). */
  delta?: number | null;
  deltaUnit?: string;
  /** When true, a drop is good (e.g. "Open issues"). */
  invert?: boolean;
  trend?: number[];
  icon?: React.ReactNode;
  className?: string;
}

/** Spec 3.5: label, big number, delta with arrow and colour, tiny sparkline. */
export function KpiCard({
  label,
  value,
  delta = null,
  deltaUnit = "",
  invert = false,
  trend,
  icon,
  className,
}: KpiCardProps) {
  const direction = delta === null || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const good = direction === "flat" ? null : (direction === "up") !== invert;
  const Arrow = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const deltaText =
    delta === null
      ? null
      : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toLocaleString("en-GB", { maximumFractionDigits: 1 })}${deltaUnit}`;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-(--radius-lg) border border-border bg-card p-5 shadow-soft",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-full bg-role-soft text-role-strong"
          >
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="tabular font-heading text-[2rem] leading-none font-semibold">{value}</p>
        {trend && <Sparkline values={trend} />}
      </div>
      {deltaText && (
        <p
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold",
            good === null ? "text-muted-foreground" : good ? "text-(--status-ontime-fg)" : "text-(--status-absent-fg)",
          )}
        >
          <Arrow aria-hidden className="size-3.5" />
          <span>
            {deltaText}
            <span className="font-normal text-muted-foreground"> vs previous period</span>
          </span>
        </p>
      )}
    </div>
  );
}
