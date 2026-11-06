import { cn } from "@/lib/utils";
import { GradientBackdrop } from "./GradientBackdrop";

interface HeroBannerProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  variant?: "hero" | "sunrise" | "fresh";
  className?: string;
}

/** Large gradient banner with title, subtitle, actions and an optional right-hand slot. */
export function HeroBanner({ eyebrow, title, subtitle, actions, aside, variant = "hero", className }: HeroBannerProps) {
  return (
    <GradientBackdrop variant={variant} className={cn("rounded-(--radius-xl) text-white shadow-lift", className)}>
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div className="space-y-4">
          {eyebrow && <p className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">{eyebrow}</p>}
          <h2 className="text-3xl font-semibold text-balance sm:text-[2.5rem]">{title}</h2>
          {subtitle && <p className="max-w-xl text-base text-white/85">{subtitle}</p>}
          {actions && <div className="flex flex-wrap gap-3 pt-2">{actions}</div>}
        </div>
        {aside && <div>{aside}</div>}
      </div>
    </GradientBackdrop>
  );
}
