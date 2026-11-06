import { cn } from "@/lib/utils";

type Variant = "hero" | "gold" | "fresh" | "sunrise" | "sidebar";

interface GradientBackdropProps {
  variant?: Variant;
  /** Adds the soft dotted pattern and glow orbs used on hero areas. */
  decorated?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const variantClass: Record<Variant, string> = {
  hero: "bg-grad-hero",
  gold: "bg-grad-gold",
  fresh: "bg-grad-fresh",
  sunrise: "bg-grad-sunrise",
  sidebar: "bg-grad-sidebar",
};

/** Decorative gradient surface. Purely visual, hidden from assistive technology. */
export function GradientBackdrop({ variant = "hero", decorated = true, className, children }: GradientBackdropProps) {
  return (
    <div className={cn("relative isolate overflow-hidden", variantClass[variant], className)}>
      {decorated && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
              maskImage: "linear-gradient(120deg, black 0%, transparent 70%)",
            }}
          />
          <div className="absolute -top-24 -right-16 size-72 rounded-full bg-gold-500/25 blur-3xl" />
          <div className="absolute -bottom-28 -left-10 size-80 rounded-full bg-sky-400/25 blur-3xl" />
        </div>
      )}
      {children}
    </div>
  );
}
