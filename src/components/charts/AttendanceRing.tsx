"use client";

import { motion, useReducedMotion } from "framer-motion";
import { band, type BandKey } from "@/lib/attendance/percentage";
import { cn } from "@/lib/utils";

const bandColor: Record<BandKey, string> = {
  gold: "var(--band-gold)",
  green: "var(--band-green)",
  amber: "var(--band-amber)",
  red: "var(--band-red)",
  none: "var(--status-none)",
};

interface AttendanceRingProps {
  percent: number | null;
  /** Small label under the number, e.g. "Overall". */
  label?: string;
  size?: number;
  stroke?: number;
  showBand?: boolean;
  className?: string;
}

/**
 * Spec 3.5: SVG ring with animated fill (800ms), big percentage, small label, colour by band,
 * and the band name printed so status never relies on colour alone.
 */
export function AttendanceRing({
  percent,
  label = "Attendance",
  size = 168,
  stroke = 14,
  showBand = true,
  className,
}: AttendanceRingProps) {
  const reduce = useReducedMotion();
  const b = band(percent);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = percent ?? 0;
  const offset = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  const display = percent === null ? "–" : `${percent.toFixed(1).replace(/\.0$/, "")}%`;

  return (
    <figure
      className={cn("inline-flex flex-col items-center gap-2", className)}
      aria-label={`${label}: ${percent === null ? "no meetings yet" : `${percent} percent`}, ${b.label}`}
      data-band={b.key}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mist)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={bandColor[b.key]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: reduce ? offset : c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular font-heading font-semibold" style={{ fontSize: size * 0.2 }}>
            {display}
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
      {showBand && (
        <figcaption
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: `color-mix(in srgb, ${bandColor[b.key]} 16%, transparent)` }}
        >
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: bandColor[b.key] }} />
          {b.label}
        </figcaption>
      )}
    </figure>
  );
}
