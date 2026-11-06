import Link from "next/link";
import { ArrowRight, Database, Palette, PanelsTopLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { GradientBackdrop } from "@/components/brand/GradientBackdrop";
import { Button } from "@/components/ui/button";

/**
 * Temporary build-preview home. The full landing page (spec 7.1) replaces this in Phase 2.
 */
export default function Home() {
  const links = [
    {
      href: "/design-system",
      label: "Design system",
      text: "Tokens, typography and every core component in light and dark.",
      icon: Palette,
    },
    {
      href: "/design-system/shell",
      label: "App shell",
      text: "Member, volunteer and admin frames with sidebar and bottom tabs.",
      icon: PanelsTopLeft,
    },
    {
      href: "/dev/data",
      label: "Demo data and rules",
      text: "The seeded unit, demo accounts and live business rules with simulated time.",
      icon: Database,
    },
  ];
  return (
    <GradientBackdrop variant="hero" className="min-h-dvh text-white">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-10 px-4 py-16 outline-none sm:px-6"
      >
        <div className="space-y-5">
          <Logo size={88} priority />
          <p className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
            HOD Sanitation Hub · Build preview
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">
            Serving God with excellence, one clean space at a time
          </h1>
          <p className="max-w-2xl text-lg text-white/85">
            Phases 0 and 1 are ready for review: the design system and the data and rules layer. The public landing page
            and sign-in arrive in Phase 2.
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {links.map(({ href, label, text, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group bg-grad-glass flex h-full flex-col gap-3 rounded-(--radius-lg) border border-white/15 p-5 backdrop-blur-md transition-transform hover:-translate-y-0.5"
              >
                <Icon aria-hidden className="size-6 text-gold-300" />
                <span className="font-heading text-xl font-semibold">{label}</span>
                <span className="text-sm text-white/80">{text}</span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-gold-300">
                  Open <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div>
          <Button asChild variant="gold" size="lg">
            <Link href="/design-system">
              Start with the design system <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </main>
    </GradientBackdrop>
  );
}
