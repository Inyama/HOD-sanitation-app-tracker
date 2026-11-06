import { Construction } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard } from "@/components/ui/glass-card";

/** Placeholder for screens that later build phases deliver. The page guard already ran. */
export function ComingSoon({ title, phase, points }: { title: string; phase: number; points?: string[] }) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={`This screen is built in Phase ${phase}. Access to it is already enforced.`}
      />
      <GlassCard className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-role-soft text-role-strong">
          <Construction aria-hidden className="size-6" />
        </span>
        <div className="space-y-2">
          <p className="font-semibold">Coming in Phase {phase}</p>
          {points && points.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </GlassCard>
    </>
  );
}
