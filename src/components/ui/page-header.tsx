import * as React from "react";
import { cn } from "@/lib/utils";

/** Spec 3.6: title (Fraunces), one-line subtitle, primary action on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.9375rem] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
