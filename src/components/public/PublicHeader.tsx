import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#schedule", label: "Schedule" },
  { href: "/#venue", label: "Venue" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
];

/** Header for public pages. `onDark` renders it transparent over the landing hero. */
export function PublicHeader({ onDark = false }: { onDark?: boolean }) {
  return (
    <header
      className={cn(
        "z-30 w-full",
        onDark ? "absolute top-0 text-white" : "sticky top-0 border-b border-border bg-background/85 backdrop-blur-lg",
      )}
    >
      <div className="demo-pad mx-auto flex h-18 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-full">
          <Logo size={40} className="sm:hidden" />
          <Logo size={40} withWordmark onDark={onDark} className="hidden sm:inline-flex" />
        </Link>
        <nav aria-label="Main" className="ml-6 hidden lg:block">
          <ul className="flex gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full px-3.5 text-sm font-medium",
                    onDark
                      ? "text-white/85 hover:bg-white/10 hover:text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle onDark={onDark} className="hidden md:inline-flex" />
          <Button asChild variant={onDark ? "gold" : "default"} size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
