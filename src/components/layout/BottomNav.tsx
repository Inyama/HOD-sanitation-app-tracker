"use client";

import Link from "next/link";
import { useState } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NAV, ROLE_META, isActive, type ShellRole } from "./nav";

/** Phone (below 768px) bottom tab bar: four main destinations plus "More" which opens a sheet. */
export function BottomNav({ role, pathname, hidden = [] }: { role: ShellRole; pathname: string; hidden?: string[] }) {
  const [open, setOpen] = useState(false);
  const home = ROLE_META[role].home;
  const all = NAV[role].flatMap((g) => g.items).filter((i) => !hidden.includes(i.href));
  const primary = all.filter((i) => i.primary).slice(0, 4);
  const moreGroups = NAV[role]
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.primary && !hidden.includes(i.href)) }))
    .filter((g) => g.items.length);
  const moreActive = moreGroups.some((g) => g.items.some((i) => isActive(pathname, i.href, home)));

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {primary.map((item) => {
            const active = isActive(pathname, item.href, home);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                    active ? "text-role-strong" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-role-soft",
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={cn(
                "flex h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                moreActive ? "text-role-strong" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-12 items-center justify-center rounded-full",
                  moreActive && "bg-role-soft",
                )}
              >
                <Ellipsis aria-hidden className="size-5" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-(--radius-xl)" data-role={role}>
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">More</SheetTitle>
            <SheetDescription>Everything else in your {ROLE_META[role].label.toLowerCase()} area.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {moreGroups.map((g, gi) => (
              <div key={gi}>
                {g.label && (
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</p>
                )}
                <ul className="grid grid-cols-2 gap-2">
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href, home);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center gap-2.5 rounded-(--radius-sm) border px-3 py-2 text-sm font-medium",
                            active ? "border-role/40 bg-role-soft text-role-strong" : "border-border hover:bg-muted",
                          )}
                        >
                          <Icon aria-hidden className="size-4 shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
