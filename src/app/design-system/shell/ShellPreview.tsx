"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarRange, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ROLE_META, type ShellRole } from "@/components/layout/nav";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { KpiCard } from "@/components/charts/KpiCard";
import { StatusChip } from "@/components/attendance/StatusChip";
import { CountdownHero } from "@/components/brand/CountdownHero";
import { nextOccurrences, SATURDAY_RULE } from "@/lib/time/schedule";
import { now } from "@/lib/time/clock";

const users = {
  member: { name: "Adebayo Johnson", email: "member@hod-demo.example.com" },
  volunteer: { name: "Grace Adeyemi", email: "volunteer@hod-demo.example.com", detail: "Team Lead" },
  admin: { name: "Pastor Daniel Ojo", email: "admin@hod-demo.example.com", detail: "Super Admin" },
};

export function ShellPreview() {
  const [role, setRole] = React.useState<ShellRole>("member");
  const [nextSaturday] = React.useState(() => nextOccurrences(SATURDAY_RULE, now(), 1)[0].toISO()!);

  return (
    <AppShell
      role={role}
      user={users[role]}
      unread={role === "member" ? 3 : role === "volunteer" ? 1 : 6}
      pathnameOverride={ROLE_META[role].home}
      dateRange={
        role === "admin" ? (
          <Button variant="outline" size="sm">
            <CalendarRange aria-hidden /> Last 12 weeks
          </Button>
        ) : undefined
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-(--radius-md) border border-dashed border-border bg-surface p-3">
        <p className="text-sm text-muted-foreground">
          Preview only. Links in the navigation lead to screens built in later phases.{" "}
          <Link href="/design-system" className="font-medium text-role-strong underline">
            Back to the design system
          </Link>
        </p>
        <div
          role="radiogroup"
          aria-label="Preview role"
          className="inline-flex rounded-full border border-border bg-background p-0.5"
        >
          {(["member", "volunteer", "admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={`h-9 cursor-pointer rounded-full px-4 text-sm font-medium pointer-coarse:h-11 ${
                role === r ? "bg-role-btn text-role-btn-fg" : "text-muted-foreground hover:text-foreground"
              }`}
              data-role={r}
            >
              {ROLE_META[r].label}
            </button>
          ))}
        </div>
      </div>

      <PageHeader
        title={role === "admin" ? "Dashboard" : `Welcome back, ${users[role].name.split(" ")[0]}`}
        subtitle={role === "admin" ? "Unit overview for the last 12 weeks." : "Here is your week at a glance."}
        actions={<Button variant="role">{role === "admin" ? "Upload sheet" : "Check in now"}</Button>}
      />

      {role === "admin" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Active members" value="55" delta={3} trend={[49, 50, 52, 53, 55]} />
          <KpiCard label="Average attendance" value="78.4%" delta={2.1} deltaUnit=" pts" trend={[72, 74, 76, 78.4]} />
          <KpiCard label="Pending approvals" value="4" delta={0} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <CountdownHero
            meetingName="Saturday Sanitation Meeting"
            startsAt={nextSaturday}
            venue="7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos"
            action={
              <Button variant="gold" size="lg" disabled>
                <MapPin aria-hidden /> Check in now
              </Button>
            }
            actionHint="Opens Saturday 8:30 am"
          />
          <GlassCard className="flex flex-col items-center justify-center">
            <AttendanceRing percent={role === "member" ? 88 : 94} label="Overall" />
          </GlassCard>
          <GlassCard className="lg:col-span-2">
            <GlassCardHeader title="Recent activity" description="Your last meetings" />
            <div className="flex flex-wrap gap-2">
              <StatusChip status="ON_TIME" label="Thu 5 Nov · On time" />
              <StatusChip status="ON_TIME" label="Sat 31 Oct · On time" />
              <StatusChip status="LATE" label="Thu 29 Oct · Late" />
              <StatusChip status="EXCUSED" label="Sat 24 Oct · Excused" />
            </div>
          </GlassCard>
        </div>
      )}
    </AppShell>
  );
}
