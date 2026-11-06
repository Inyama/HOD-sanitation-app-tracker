import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { GradientBackdrop } from "@/components/brand/GradientBackdrop";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

/** Centred card on the navy gradient, used by sign-in, sign-up and recovery screens (spec 7.1). */
export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <GradientBackdrop variant="hero" className="min-h-dvh">
      <div className="demo-pad mx-auto flex max-w-6xl items-center justify-between px-4 pt-5 sm:px-6">
        <Link href="/" className="rounded-full">
          <Logo size={40} withWordmark onDark />
        </Link>
        <ThemeToggle onDark className="hidden sm:inline-flex" />
      </div>
      <main id="main" tabIndex={-1} className="flex justify-center px-4 py-8 outline-none sm:py-12">
        <div className={cn("w-full", wide ? "max-w-2xl" : "max-w-md")}>
          <div className="rounded-(--radius-xl) border border-white/15 bg-card p-6 text-card-foreground shadow-lift sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h1 className="text-2xl font-semibold sm:text-[1.75rem]">{title}</h1>
              {subtitle && <p className="text-[0.9375rem] text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="mt-6 text-center text-sm text-white/85">{footer}</div>}
        </div>
      </main>
    </GradientBackdrop>
  );
}
