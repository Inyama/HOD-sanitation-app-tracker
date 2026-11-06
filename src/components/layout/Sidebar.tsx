"use client";

import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV, ROLE_META, isActive, type ShellRole } from "./nav";

interface SidebarProps {
  role: ShellRole;
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Hrefs the current person cannot open (hidden from nav; the server still guards them). */
  hidden?: string[];
}

/** Desktop and tablet (768px and up) navy gradient sidebar with role-coloured active item. */
export function Sidebar({ role, pathname, collapsed, onToggle, hidden = [] }: SidebarProps) {
  const home = ROLE_META[role].home;
  return (
    <aside
      className={cn(
        "bg-grad-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
      aria-label="Sidebar"
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        <Link
          href={home}
          className="rounded-(--radius-sm)"
          aria-label={collapsed ? "HOD Sanitation Hub home" : undefined}
        >
          {collapsed ? <Logo size={36} /> : <Logo size={36} withWordmark onDark />}
        </Link>
      </div>

      <nav aria-label="Main" className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV[role].map((group, gi) => {
          const items = group.items.filter((i) => !hidden.includes(i.href));
          if (!items.length) return null;
          return (
            <div key={gi}>
              {group.label && !collapsed && (
                <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-white/50 uppercase">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href, home);
                  const Icon = item.icon;
                  const link = (
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-11 items-center gap-3 rounded-(--radius-sm) px-3 text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && (
                        <span aria-hidden className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-role" />
                      )}
                      <Icon aria-hidden className={cn("size-[18px] shrink-0", active && "text-role")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {collapsed && <span className="sr-only">{item.label}</span>}
                      {!!item.badge && !collapsed && (
                        <span className="ml-auto rounded-full bg-role px-1.5 text-[0.6875rem] font-bold text-role-contrast">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-11 w-full cursor-pointer items-center gap-3 rounded-(--radius-sm) px-3 text-sm text-white/70 hover:bg-white/5 hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronsRight aria-hidden className="size-[18px]" />
          ) : (
            <ChevronsLeft aria-hidden className="size-[18px]" />
          )}
          {collapsed ? <span className="sr-only">Expand sidebar</span> : "Collapse"}
        </button>
      </div>
    </aside>
  );
}
