import { CircleCheck, Clock3, CircleX, ShieldCheck, Hand, Flag, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipStatus = "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED" | "MANUAL" | "FLAGGED" | "PENDING";

const config: Record<ChipStatus, { label: string; icon: typeof CircleCheck; className: string }> = {
  ON_TIME: {
    label: "On time",
    icon: CircleCheck,
    className: "bg-(--status-ontime-bg) text-(--status-ontime-fg) border-transparent",
  },
  LATE: {
    label: "Late",
    icon: Clock3,
    className: "bg-(--status-late-bg) text-(--status-late-fg) border-transparent",
  },
  ABSENT: {
    label: "Absent",
    icon: CircleX,
    className: "bg-(--status-absent-bg) text-(--status-absent-fg) border-transparent",
  },
  EXCUSED: {
    label: "Excused",
    icon: ShieldCheck,
    className: "bg-(--status-excused-bg) text-(--status-excused-fg) border-transparent",
  },
  MANUAL: {
    label: "Manual",
    icon: Hand,
    className: "bg-transparent text-muted-foreground border-muted-foreground/60",
  },
  FLAGGED: {
    label: "Flagged",
    icon: Flag,
    className: "bg-transparent text-(--status-absent-fg) border-(--status-absent)",
  },
  PENDING: {
    label: "Pending",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground border-transparent",
  },
};

export const statusLabel = (s: ChipStatus) => config[s].label;

interface StatusChipProps {
  status: ChipStatus;
  /** Override the visible text, e.g. "Late · 9:42 am". */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

/** Status is always icon + text, never colour alone (spec 3.8). */
export function StatusChip({ status, label, size = "md", className }: StatusChipProps) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[0.8125rem]",
        c.className,
        className,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "size-3.5" : "size-4"} />
      {label ?? c.label}
    </span>
  );
}
