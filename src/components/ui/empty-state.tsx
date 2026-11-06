import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TriangleAlert } from "lucide-react";

type Illustration = "calendar" | "inbox" | "broom" | "search" | "chart";

/** Small branded line illustrations; decorative only. */
function Art({ kind }: { kind: Illustration }) {
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-30" aria-hidden>
      <defs>
        <linearGradient id={`es-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--sky-100)" />
          <stop offset="1" stopColor="var(--gold-100)" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="84" rx="44" ry="6" fill="var(--mist)" opacity=".7" />
      <rect x="22" y="14" width="76" height="62" rx="14" fill={`url(#es-${kind})`} />
      {kind === "calendar" && (
        <g stroke="var(--royal-600)" strokeWidth="3" fill="none" strokeLinecap="round">
          <rect x="36" y="28" width="48" height="38" rx="6" />
          <path d="M36 40h48M48 22v10M72 22v10" />
          <circle cx="60" cy="53" r="4" fill="var(--gold-500)" stroke="none" />
        </g>
      )}
      {kind === "inbox" && (
        <g stroke="var(--royal-600)" strokeWidth="3" fill="none" strokeLinejoin="round">
          <path d="M34 50l8-20h36l8 20v14H34z" />
          <path d="M34 50h14l4 6h16l4-6h14" />
        </g>
      )}
      {kind === "broom" && (
        <g stroke="var(--royal-600)" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M76 22L58 48" />
          <path d="M50 46l14 10-6 14H40z" fill="var(--gold-300)" />
          <path d="M44 70l3-8M50 70l2-8M56 70l1-8" />
        </g>
      )}
      {kind === "search" && (
        <g stroke="var(--royal-600)" strokeWidth="3.5" fill="none" strokeLinecap="round">
          <circle cx="56" cy="44" r="14" />
          <path d="M66 54l12 12" />
        </g>
      )}
      {kind === "chart" && (
        <g stroke="var(--royal-600)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M36 64V30M36 64h50" />
          <path d="M42 56l12-12 10 8 16-18" stroke="var(--teal-600)" />
        </g>
      )}
    </svg>
  );
}

interface EmptyStateProps {
  illustration?: Illustration;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Spec 3.5: illustration, one sentence, one action button. */
export function EmptyState({ illustration = "broom", title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      <Art kind={illustration} />
      <div className="space-y-1">
        <p className="font-heading text-lg font-semibold">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this. Check your connection and try again.",
  action,
  className,
}: Partial<EmptyStateProps>) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-(--radius-md) border border-(--status-absent)/40 bg-(--status-absent-bg) px-6 py-8 text-center text-(--status-absent-fg)",
        className,
      )}
    >
      <TriangleAlert aria-hidden className="size-8" />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm opacity-90">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingState({
  rows = 3,
  label = "Loading",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-(--radius-sm)" />
      ))}
    </div>
  );
}
