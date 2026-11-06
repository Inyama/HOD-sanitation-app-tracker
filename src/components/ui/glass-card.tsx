import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassCard = cva(
  "relative rounded-(--radius-lg) border transition-[transform,box-shadow] duration-200 motion-reduce:transition-none",
  {
    variants: {
      tone: {
        light: "border-border/70 bg-card/90 text-card-foreground shadow-soft backdrop-blur-sm",
        dark: "border-white/15 bg-grad-glass text-white shadow-lift backdrop-blur-md",
        accent: "border-role/30 bg-role-soft text-foreground shadow-soft",
      },
      interactive: {
        true: "hover:-translate-y-0.5 hover:shadow-lift focus-within:-translate-y-0.5",
        false: "",
      },
      padding: {
        none: "",
        sm: "p-4",
        md: "p-5 sm:p-6",
        lg: "p-6 sm:p-8",
      },
    },
    defaultVariants: { tone: "light", interactive: false, padding: "md" },
  },
);

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof glassCard> {
  as?: "div" | "section" | "article" | "li";
}

/** Spec 3.5: 20px radius, 1px translucent border, soft shadow, 2px lift on hover. */
export function GlassCard({ className, tone, interactive, padding, as = "div", ...props }: GlassCardProps) {
  const Comp = as as "div";
  return <Comp className={cn(glassCard({ tone, interactive, padding }), className)} {...props} />;
}

export function GlassCardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
