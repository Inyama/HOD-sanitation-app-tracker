import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  /** Use light text for the wordmark when the logo sits on a dark background. */
  onDark?: boolean;
  className?: string;
  priority?: boolean;
}

/**
 * HOD logo. The artwork has a white-filled ellipse, so it reads on both light
 * and dark backgrounds without a pill (see docs/DECISIONS.md).
 */
export function Logo({ size = 40, withWordmark = false, onDark = false, className, priority }: LogoProps) {
  const height = Math.round(size * (528 / 578));
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/images/HOD-logo.webp"
        alt={withWordmark ? "" : "Household of David"}
        width={size}
        height={height}
        priority={priority}
        className="shrink-0 drop-shadow-sm"
      />
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-heading text-[1.05rem] font-semibold tracking-tight",
              onDark ? "text-white" : "text-navy-900 dark:text-white",
            )}
          >
            HOD Sanitation Hub
          </span>
          <span
            className={cn(
              "mt-1 text-[0.6875rem] font-medium tracking-[0.14em] uppercase",
              onDark ? "text-gold-300" : "text-gold-700 dark:text-gold-300",
            )}
          >
            Household of David
          </span>
        </span>
      )}
    </span>
  );
}
