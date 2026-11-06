import { isDemoMode } from "@/lib/env";

/** Corner ribbon shown whenever demo mode is on (spec 3.5, 10.1). */
export function DemoRibbon({ force }: { force?: boolean }) {
  if (!force && !isDemoMode()) return null;
  return (
    <div className="pointer-events-none fixed top-0 right-0 z-[60] size-[76px] overflow-hidden">
      <div
        role="note"
        aria-label="Demo data: everything shown is fictional sample data"
        className="bg-grad-gold absolute top-[15px] right-[-38px] w-36 rotate-45 py-0.5 text-center text-[0.625rem] font-bold tracking-[0.12em] text-navy-900 uppercase shadow-lift"
      >
        Demo data
      </div>
    </div>
  );
}
