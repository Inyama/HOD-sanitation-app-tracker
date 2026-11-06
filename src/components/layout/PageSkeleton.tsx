import { Skeleton } from "@/components/ui/skeleton";

/** Static shell shown while a time-dependent page streams in (Cache Components). */
export function PageSkeleton({ label = "Loading page" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-10 sm:px-6">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-10 w-64 rounded-full" />
      <Skeleton className="h-56 w-full rounded-(--radius-xl)" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 rounded-(--radius-lg)" />
        <Skeleton className="h-36 rounded-(--radius-lg)" />
        <Skeleton className="h-36 rounded-(--radius-lg)" />
      </div>
    </div>
  );
}
