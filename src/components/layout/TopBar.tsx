"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Search, Settings, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "./RoleBadge";
import { ROLE_META, type ShellRole } from "./nav";

export interface ShellUser {
  name: string;
  email: string;
  /** e.g. "Super Admin" or "Team Lead". */
  detail?: string;
}

interface TopBarProps {
  role: ShellRole;
  user: ShellUser;
  unread?: number;
  /** Admin: global date-range picker slot (spec 7.4). */
  dateRange?: React.ReactNode;
  settingsHref?: string;
}

export function TopBar({ role, user, unread = 0, dateRange, settingsHref }: TopBarProps) {
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login?reason=signed-out");
    router.refresh();
  };
  const home = ROLE_META[role].home;
  const notificationsHref =
    role === "admin" ? "/admin/automation" : `${home === "/volunteer" ? "/member" : home}/notifications`;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
      <div className="demo-pad mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
        <Link href={home} className="md:hidden" aria-label="HOD Sanitation Hub home">
          <Logo size={34} />
        </Link>

        <form role="search" className="relative hidden max-w-sm flex-1 md:block" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="global-search" className="sr-only">
            Search
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="global-search"
            type="search"
            placeholder={role === "admin" ? "Search people, meetings, uploads" : "Search meetings and messages"}
            className="h-10 w-full rounded-full border border-input bg-surface pr-4 pl-10 text-sm placeholder:text-muted-foreground"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          {dateRange && <div className="hidden lg:block">{dateRange}</div>}
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href={notificationsHref}
            className="relative inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <Bell aria-hidden className="size-5" />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 min-w-4.5 rounded-full bg-hod-red px-1 text-center text-[0.625rem] leading-4.5 font-bold text-white"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex cursor-pointer items-center gap-2 rounded-full p-0.5 pr-0.5 hover:bg-muted sm:pr-3">
              <span className="sr-only">Account menu: </span>
              <UserAvatar name={user.name} size={38} />
              <span className="sr-only text-left leading-tight lg:not-sr-only lg:block">
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="block text-xs text-muted-foreground">{user.detail ?? ROLE_META[role].label}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="space-y-1.5">
                <span className="block font-semibold">{user.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">{user.email}</span>
                <RoleBadge role={role} detail={user.detail} />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={settingsHref ?? `${home}/settings`}>
                  <UserRound aria-hidden /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={settingsHref ?? `${home}/settings`}>
                  <Settings aria-hidden /> Settings
                </Link>
              </DropdownMenuItem>
              <div className="px-2 py-1.5 sm:hidden">
                <ThemeToggle />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut aria-hidden /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
