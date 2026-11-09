import { Ban, CircleCheck, Clock3, Trash2 } from "lucide-react";
import type { UserStatus } from "@/lib/repo/types";
import { cn } from "@/lib/utils";

/** Small labelled chips for admin tables. Each shows a word (and icon), never colour alone (spec 3.8). */

const BAND: Record<string, string> = {
  gold: "bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-300",
  green: "bg-(--status-ontime-bg) text-(--status-ontime-fg)",
  amber: "bg-(--status-late-bg) text-(--status-late-fg)",
  red: "bg-(--status-absent-bg) text-(--status-absent-fg)",
  none: "bg-muted text-muted-foreground",
};

export function BandChip({ bandKey, label, className }: { bandKey: string; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap",
        BAND[bandKey] ?? BAND.none,
        className,
      )}
    >
      {label}
    </span>
  );
}

const STATUS: Record<UserStatus, { label: string; cls: string; icon: typeof Ban }> = {
  ACTIVE: { label: "Active", cls: "bg-(--status-ontime-bg) text-(--status-ontime-fg)", icon: CircleCheck },
  PENDING: { label: "Pending", cls: "bg-(--status-late-bg) text-(--status-late-fg)", icon: Clock3 },
  SUSPENDED: { label: "Suspended", cls: "bg-(--status-absent-bg) text-(--status-absent-fg)", icon: Ban },
  REMOVED: { label: "Removed", cls: "bg-muted text-muted-foreground", icon: Trash2 },
};

export function PersonStatusChip({
  status,
  deletionRequested = false,
  className,
}: {
  status: UserStatus;
  deletionRequested?: boolean;
  className?: string;
}) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
          s.cls,
        )}
      >
        <s.icon aria-hidden className="size-3" /> {s.label}
      </span>
      {deletionRequested && status !== "REMOVED" && (
        <span className="text-[0.6875rem] font-medium text-(--status-absent-fg)">Asked to be deleted</span>
      )}
    </span>
  );
}
