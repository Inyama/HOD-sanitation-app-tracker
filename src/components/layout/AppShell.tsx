"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar, type ShellUser } from "./TopBar";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import type { ShellRole } from "./nav";

interface AppShellProps {
  role: ShellRole;
  user: ShellUser;
  unread?: number;
  dateRange?: React.ReactNode;
  /** Override the detected path (used by the design-system preview). */
  pathnameOverride?: string;
  hiddenNav?: string[];
  children: React.ReactNode;
}

const COLLAPSE_KEY = "hod.sidebar.collapsed";

/**
 * Role-aware application frame (spec 3.6): sidebar from 768px, bottom tab bar below,
 * sticky top bar, centred content up to 1280px, page fade-and-rise on navigation.
 */
export function AppShell({ role, user, unread, dateRange, pathnameOverride, hiddenNav, children }: AppShellProps) {
  const detected = usePathname();
  const pathname = pathnameOverride ?? detected ?? "/";
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = useStoredFlag(COLLAPSE_KEY);
  const toggle = () => setCollapsed(!collapsed);

  return (
    <div data-role={role} className="flex min-h-dvh bg-background">
      <Sidebar role={role} pathname={pathname} collapsed={collapsed} onToggle={toggle} hidden={hiddenNav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar role={role} user={user} unread={unread} dateRange={dateRange} />
        <motion.main
          id="main"
          tabIndex={-1}
          key={pathname}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 md:pb-12"
        >
          {children}
        </motion.main>
      </div>
      <BottomNav role={role} pathname={pathname} hidden={hiddenNav} />
    </div>
  );
}
