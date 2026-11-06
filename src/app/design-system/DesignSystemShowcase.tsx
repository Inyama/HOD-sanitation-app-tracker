"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarCheck,
  MapPin,
  Sparkles,
  Users,
  Percent,
  Timer,
  UserCheck,
  TriangleAlert,
  Inbox,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { HeroBanner } from "@/components/brand/HeroBanner";
import { PhotoCard } from "@/components/brand/PhotoCard";
import { CountdownHero } from "@/components/brand/CountdownHero";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { StatusChip } from "@/components/attendance/StatusChip";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { Heatmap } from "@/components/charts/Heatmap";
import { KpiCard } from "@/components/charts/KpiCard";
import { TrendLine } from "@/components/charts/TrendLine";
import { StackedBars } from "@/components/charts/StackedBars";
import { Donut } from "@/components/charts/Donut";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/empty-state";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { attendancePercent, onTimeRate, band } from "@/lib/attendance/percentage";
import { lagosTime } from "@/lib/time/zone";
import { sampleHeatCells, trendData, teamData, monthlyStatus, samplePeople, type SamplePerson } from "./sample-data";

const swatches: { group: string; items: { name: string; var: string; text?: string }[] }[] = [
  {
    group: "Navy and royal",
    items: [
      { name: "navy-950", var: "--navy-950" },
      { name: "navy-900", var: "--navy-900" },
      { name: "navy-800", var: "--navy-800" },
      { name: "royal-700", var: "--royal-700" },
      { name: "royal-600", var: "--royal-600" },
      { name: "royal-500", var: "--royal-500" },
      { name: "sky-400", var: "--sky-400", text: "#0a1a44" },
      { name: "sky-100", var: "--sky-100", text: "#0a1a44" },
    ],
  },
  {
    group: "Gold and teal",
    items: [
      { name: "gold-700", var: "--gold-700" },
      { name: "gold-600", var: "--gold-600", text: "#0a1a44" },
      { name: "gold-500", var: "--gold-500", text: "#0a1a44" },
      { name: "gold-300", var: "--gold-300", text: "#0a1a44" },
      { name: "gold-100", var: "--gold-100", text: "#0a1a44" },
      { name: "teal-700", var: "--teal-700" },
      { name: "teal-600", var: "--teal-600" },
      { name: "teal-500", var: "--teal-500", text: "#042f2e" },
    ],
  },
  {
    group: "Status and logo",
    items: [
      { name: "success", var: "--success" },
      { name: "warning", var: "--warning", text: "#0a1a44" },
      { name: "danger", var: "--danger" },
      { name: "info", var: "--info" },
      { name: "logo navy", var: "--hod-logo-navy" },
      { name: "logo red", var: "--hod-logo-red" },
      { name: "ink", var: "--ink" },
      { name: "paper", var: "--paper", text: "var(--ink)" },
    ],
  },
];

const gradients = [
  { name: "grad-hero", cls: "bg-grad-hero" },
  { name: "grad-gold", cls: "bg-grad-gold" },
  { name: "grad-fresh", cls: "bg-grad-fresh" },
  { name: "grad-sunrise", cls: "bg-grad-sunrise" },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-5">
      <div>
        <h2 id={`${id}-title`} className="text-2xl font-semibold">
          {title}
        </h2>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const toc = [
  ["tokens", "Tokens"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["cards", "Cards"],
  ["status", "Status"],
  ["rings", "Attendance ring"],
  ["kpis", "KPIs"],
  ["countdown", "Countdown"],
  ["heatmap", "Heatmap"],
  ["charts", "Charts"],
  ["table", "Table"],
  ["states", "States"],
  ["overlays", "Dialogs"],
  ["forms", "Forms"],
  ["imagery", "Imagery"],
] as const;

export function DesignSystemShowcase() {
  const worked = { onTime: 14, late: 3, absent: 2, excused: 1 };
  const nextSaturday = lagosTime(2026, 11, 7, 9, 30).toISO()!;
  const [tableState, setTableState] = React.useState<"ready" | "loading" | "empty" | "error">("ready");
  const [formError, setFormError] = React.useState(true);

  const columns: Column<SamplePerson>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <span className="inline-flex items-center gap-2.5">
          <UserAvatar name={r.name} size={30} />
          <span className="font-medium">{r.name}</span>
        </span>
      ),
    },
    { key: "team", header: "Team", sortValue: (r) => r.team, cell: (r) => r.team },
    { key: "role", header: "Role", sortValue: (r) => r.role, cell: (r) => r.role, hideOnMobile: true },
    {
      key: "pct",
      header: "Attendance",
      align: "right",
      sortValue: (r) => r.pct,
      cell: (r) => (
        <span>
          <span className="font-semibold">{r.pct}%</span>{" "}
          <span className="text-xs text-muted-foreground">{band(r.pct).label}</span>
        </span>
      ),
    },
    { key: "last", header: "Last meeting", cell: (r) => <StatusChip status={r.last} size="sm" /> },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="demo-pad mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <Link href="/">
            <Logo size={36} withWordmark />
          </Link>
          <span className="hidden rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-semibold text-gold-700 sm:inline dark:bg-gold-500/20 dark:text-gold-300">
            Design system
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/design-system/shell">
                App shell preview <ArrowRight aria-hidden />
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] space-y-16 px-4 py-10 outline-none sm:px-6">
        <HeroBanner
          eyebrow="HOD Sanitation Hub · Phase 0"
          title="Design system"
          subtitle="Royal navy and gold with a fresh teal accent. Every component below is the one the app uses, shown live. Switch theme at the top right to check dark mode."
          actions={
            <>
              <Button asChild variant="gold" size="lg">
                <Link href="/design-system/shell">
                  See the app shell <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link href="/dev/data">Explore demo data</Link>
              </Button>
            </>
          }
          aside={
            <div className="flex justify-center lg:justify-end">
              <div className="bg-grad-glass rounded-(--radius-xl) border border-white/15 p-6 backdrop-blur-md">
                <Logo size={140} priority />
              </div>
            </div>
          }
        />

        <nav aria-label="Sections" className="-mx-4 no-scrollbar overflow-x-auto px-4">
          <ul className="flex gap-2">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium whitespace-nowrap hover:border-role hover:text-role-strong"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section
          id="tokens"
          title="Colour tokens"
          description="From src/styles/tokens.css. Gold 700 and teal 700 were added so gold and teal text meet AA contrast on white."
        >
          <div className="space-y-6">
            {swatches.map((g) => (
              <div key={g.group}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{g.group}</h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  {g.items.map((s) => (
                    <li key={s.name} className="overflow-hidden rounded-(--radius-md) border border-border bg-card">
                      <div className="flex h-16 items-end p-2" style={{ background: `var(${s.var})` }}>
                        <span className="rounded-full bg-white/90 px-1.5 text-[0.6875rem] font-semibold text-[#0f172a]">
                          Aa
                        </span>
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-semibold">{s.name}</p>
                        <p className="font-mono text-[0.6875rem] text-muted-foreground">var({s.var})</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Gradients</h3>
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {gradients.map((g) => (
                  <li
                    key={g.name}
                    className={`flex h-24 items-end rounded-(--radius-lg) p-3 text-sm font-semibold text-white shadow-soft ${g.cls}`}
                  >
                    <span className="rounded-full bg-black/25 px-2 py-0.5 backdrop-blur">{g.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Role accents</h3>
              <div className="flex flex-wrap gap-3">
                {(["member", "volunteer", "admin"] as const).map((r) => (
                  <div
                    key={r}
                    data-role={r}
                    className="flex items-center gap-3 rounded-(--radius-md) border border-border bg-card p-3"
                  >
                    <span className="size-8 rounded-full bg-role" aria-hidden />
                    <RoleBadge role={r} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="type"
          title="Typography"
          description="Fraunces for headings, Plus Jakarta Sans for UI and body. Scale 12, 14, 16, 20, 24, 32, 48."
        >
          <GlassCard className="space-y-4">
            <p className="font-heading text-[3rem] leading-[1.2] font-semibold">Serving God with excellence</p>
            <p className="font-heading text-[2rem] leading-[1.2] font-semibold">One clean space at a time</p>
            <p className="font-heading text-2xl font-semibold">Saturday Sanitation Meeting</p>
            <p className="text-xl font-semibold">Check-in opens at 8:30 am</p>
            <p className="text-base">
              Body text at 16px with a line height of 1.5. Arrive before 9:30 am so you are marked On time.
            </p>
            <p className="text-sm text-muted-foreground">Supporting text at 14px for descriptions and hints.</p>
            <p className="text-xs text-muted-foreground">Caption text at 12px.</p>
            <p className="tabular text-2xl font-semibold">
              89.5% · 82.4% · 1,284 <span className="text-sm font-normal text-muted-foreground">(tabular figures)</span>
            </p>
          </GlassCard>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          description="44px tall on touch devices. The role variant takes the colour of the area it sits in."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {(["member", "volunteer", "admin"] as const).map((r) => (
              <GlassCard key={r} data-role={r} className="space-y-3">
                <RoleBadge role={r} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="role">Check in now</Button>
                  <Button variant="outline">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
              </GlassCard>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="gold">
              <Sparkles aria-hidden /> Gold
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Remove</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Locate me">
              <MapPin aria-hidden />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section
          id="cards"
          title="Cards"
          description="Glass card: 20px radius, translucent border, soft shadow, 2px lift on hover."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard interactive>
              <GlassCardHeader title="Light glass" description="Default surface for content." />
              <p className="text-sm text-muted-foreground">Hover me to see the lift.</p>
            </GlassCard>
            <GlassCard tone="accent" interactive data-role="volunteer">
              <GlassCardHeader title="Accent card" description="Tinted with the role colour." />
              <p className="text-sm">Volunteer teal shown here.</p>
            </GlassCard>
            <div className="bg-grad-hero rounded-(--radius-lg) p-4">
              <GlassCard tone="dark" interactive>
                <GlassCardHeader
                  title="Dark glass"
                  description={<span className="text-white/75">On navy backgrounds.</span>}
                />
                <p className="text-sm text-white/85">Uses --grad-glass.</p>
              </GlassCard>
            </div>
          </div>
        </Section>

        <Section id="status" title="Status chips" description="Every status has an icon and text, never colour alone.">
          <div className="flex flex-wrap gap-2">
            {(["ON_TIME", "LATE", "ABSENT", "EXCUSED", "MANUAL", "FLAGGED", "PENDING"] as const).map((s) => (
              <StatusChip key={s} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip status="LATE" label="Late · 9:42 am" size="sm" />
            <StatusChip status="ON_TIME" label="On time · 9:18 am" size="sm" />
          </div>
        </Section>

        <Section
          id="rings"
          title="Attendance ring"
          description="Colour by band, and the band name is always printed. Gold 90+, green 75 to 89, amber 50 to 74, red below 50."
        >
          <GlassCard>
            <div className="grid grid-cols-2 justify-items-center gap-6 sm:grid-cols-3 lg:grid-cols-6">
              <AttendanceRing percent={94} label="Grace" />
              <AttendanceRing percent={90} label="Gold edge" />
              <AttendanceRing percent={89.7} label="Just under" />
              <AttendanceRing percent={71} label="Michael" />
              <AttendanceRing percent={42.5} label="At risk" />
              <AttendanceRing percent={null} label="New" />
            </div>
          </GlassCard>
          <GlassCard tone="accent" className="flex flex-col items-center gap-6 sm:flex-row">
            <AttendanceRing percent={attendancePercent(worked)} label="Worked example" size={148} />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Spec 6.3 worked example, computed by the real functions</p>
              <p>20 meetings held: 14 on time, 3 late, 1 excused, 2 absent.</p>
              <p>
                Attendance <span className="tabular font-semibold">{attendancePercent(worked)}%</span> (17 of 19) ·
                On-time rate <span className="tabular font-semibold">{onTimeRate(worked)}%</span> (14 of 17)
              </p>
            </div>
          </GlassCard>
        </Section>

        <Section id="kpis" title="KPI cards">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-role="admin">
            <KpiCard
              label="Active members"
              value="55"
              delta={3}
              icon={<Users className="size-4" />}
              trend={[48, 49, 50, 50, 52, 53, 55]}
            />
            <KpiCard
              label="Average attendance"
              value="78.4%"
              delta={2.1}
              deltaUnit=" pts"
              icon={<Percent className="size-4" />}
              trend={[72, 74, 73, 76, 77, 78.4]}
            />
            <KpiCard
              label="On-time rate"
              value="81.2%"
              delta={-1.4}
              deltaUnit=" pts"
              icon={<Timer className="size-4" />}
              trend={[84, 83, 83, 82, 81.2]}
            />
            <KpiCard label="Pending approvals" value="4" delta={0} icon={<UserCheck className="size-4" />} />
            <KpiCard
              label="Open issues"
              value="7"
              delta={-2}
              invert
              icon={<TriangleAlert className="size-4" />}
              trend={[12, 11, 9, 9, 7]}
            />
            <KpiCard
              label="Volunteers"
              value="12"
              delta={1}
              icon={<CalendarCheck className="size-4" />}
              trend={[10, 10, 11, 11, 12]}
            />
          </div>
        </Section>

        <Section
          id="countdown"
          title="Countdown hero"
          description="Live countdown driven by the simulated clock (demo time is Friday 6 November 2026)."
        >
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
        </Section>

        <Section
          id="heatmap"
          title="Heatmap"
          description="12 months by week, one square per meeting. Tab into it, then use the arrow keys."
        >
          <GlassCard>
            <Heatmap cells={sampleHeatCells()} />
          </GlassCard>
        </Section>

        <Section
          id="charts"
          title="Charts"
          description="Recharts, one axis, thin marks, validated colour-blind-safe palette, and a table view on every chart."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <TrendLine
              title="12-week attendance trend"
              description="Average attendance by week"
              data={trendData}
              xKey="week"
              xLabel="Week"
              unit="%"
              domain={[60, 100]}
              series={[
                { key: "saturday", label: "Saturday", color: "var(--series-1)" },
                { key: "thursday", label: "Thursday", color: "var(--series-2)" },
              ]}
            />
            <StackedBars
              title="Saturday vs Thursday"
              description="Grouped bars"
              data={trendData.slice(-6)}
              xKey="week"
              xLabel="Week"
              unit="%"
              mode="grouped"
              series={[
                { key: "saturday", label: "Saturday", color: "var(--series-1)" },
                { key: "thursday", label: "Thursday", color: "var(--series-2)" },
              ]}
            />
            <StackedBars
              title="On time, late and absent by month"
              data={monthlyStatus}
              xKey="month"
              xLabel="Month"
              series={[
                { key: "onTime", label: "On time", color: "var(--status-ontime)" },
                { key: "late", label: "Late", color: "var(--status-late)" },
                { key: "absent", label: "Absent", color: "var(--status-absent)" },
              ]}
            />
            <StackedBars
              title="Attendance by team"
              data={teamData}
              xKey="team"
              xLabel="Team"
              unit="%"
              layout="horizontal"
              series={[{ key: "pct", label: "Attendance", color: "var(--series-3)" }]}
            />
            <Donut
              title="On time vs Late vs Absent"
              description="Last 12 weeks"
              centerValue="1,284"
              centerLabel="records"
              slices={[
                { key: "on", label: "On time", value: 798, color: "var(--status-ontime)" },
                { key: "late", label: "Late", value: 193, color: "var(--status-late)" },
                { key: "abs", label: "Absent", value: 218, color: "var(--status-absent)" },
                { key: "exc", label: "Excused", value: 75, color: "var(--status-excused)" },
              ]}
            />
          </div>
        </Section>

        <Section
          id="table"
          title="Table"
          description="Sticky header, sortable columns, row selection, density toggle, and cards below 640px."
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="Table state">
            {(["ready", "loading", "empty", "error"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={tableState === s ? "default" : "outline"}
                aria-pressed={tableState === s}
                onClick={() => setTableState(s)}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
          <DataTable
            caption="Members"
            columns={columns}
            rows={tableState === "empty" ? [] : samplePeople}
            getRowId={(r) => r.id}
            selectable
            loading={tableState === "loading"}
            error={tableState === "error" ? "The members list could not be loaded." : null}
            onRetry={() => setTableState("ready")}
            initialSort={{ key: "pct", dir: "desc" }}
            maxHeight={360}
            empty={
              <EmptyState
                illustration="search"
                title="No members match"
                description="Try clearing the filters."
                action={
                  <Button variant="outline" onClick={() => setTableState("ready")}>
                    Clear filters
                  </Button>
                }
              />
            }
            toolbar={<span className="text-sm font-semibold">Members</span>}
          />
        </Section>

        <Section id="states" title="Empty, loading and error states">
          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard padding="none">
              <EmptyState
                illustration="calendar"
                title="No meetings this week"
                description="New meetings will show here as soon as they are scheduled."
                action={<Button variant="role">See schedule</Button>}
              />
            </GlassCard>
            <GlassCard>
              <LoadingState rows={4} />
            </GlassCard>
            <GlassCard>
              <ErrorState
                action={
                  <Button variant="outline" size="sm">
                    Try again
                  </Button>
                }
              />
            </GlassCard>
          </div>
        </Section>

        <Section
          id="overlays"
          title="Dialogs, drawers and toasts"
          description="Focus is trapped inside, and Escape closes."
        >
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading text-xl">Confirm check-in</DialogTitle>
                  <DialogDescription>You are 25 m from the venue with 12 m GPS accuracy.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={() => toast.success("Checked in: On time at 9:18 am")}>Confirm</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open drawer</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="font-heading text-xl">New excuse request</SheetTitle>
                  <SheetDescription>Drawers are used for create and edit forms.</SheetDescription>
                </SheetHeader>
                <div className="px-4">
                  <EmptyState illustration="inbox" title="Form goes here" description="Built in Phase 3." />
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              onClick={() => toast.success("Saved", { description: "Your preferences were updated." })}
            >
              Success toast
            </Button>
            <Button variant="outline" onClick={() => toast.warning("Check-in closes at 11:30 am")}>
              Warning toast
            </Button>
            <Button variant="outline" onClick={() => toast.error("You are 2.1 km from the venue")}>
              Error toast
            </Button>
          </div>
        </Section>

        <Section
          id="forms"
          title="Form controls"
          description="Every input has a label; error text is linked with aria-describedby."
        >
          <GlassCard className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ds-email">Email</Label>
              <Input
                id="ds-email"
                type="email"
                defaultValue="adebayo@"
                aria-invalid={formError}
                aria-describedby={formError ? "ds-email-error" : "ds-email-hint"}
                onChange={(e) => setFormError(!/^\S+@\S+\.\S+$/.test(e.target.value))}
              />
              {formError ? (
                <p id="ds-email-error" className="text-sm text-(--status-absent-fg)">
                  Enter a full email address, like name@example.com.
                </p>
              ) : (
                <p id="ds-email-hint" className="text-sm text-muted-foreground">
                  We send reminders here.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-zone">Time zone</Label>
              <Select defaultValue="Africa/Lagos">
                <SelectTrigger id="ds-zone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Lagos">Lagos (UTC+1)</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="America/New_York">New York</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-(--radius-sm) border border-border p-3">
              <Label htmlFor="ds-push" className="flex-1">
                Push reminders
                <span className="block text-xs font-normal text-muted-foreground">On this device only</span>
              </Label>
              <Switch id="ds-push" defaultChecked />
            </div>
            <div className="flex items-start gap-3 rounded-(--radius-sm) border border-border p-3">
              <Checkbox id="ds-consent" className="mt-0.5" />
              <Label htmlFor="ds-consent" className="leading-snug font-normal">
                I agree that my location is read only when I press Check in.
              </Label>
            </div>
          </GlassCard>
          <div className="flex flex-wrap items-center gap-3">
            {["Adebayo Johnson", "Grace Adeyemi", "Pastor Daniel Ojo", "Chioma Okafor", "Ruth Williams"].map((n) => (
              <span key={n} className="inline-flex items-center gap-2 text-sm">
                <UserAvatar name={n} /> {n}
              </span>
            ))}
          </div>
        </Section>

        <Section
          id="imagery"
          title="Imagery"
          description="Photo downloads were blocked while building, so each slot shows branded placeholder art. Drop royalty-free photos in public/images/photos and list them in photos.json; text always sits on a navy overlay."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PhotoCard slot="church-interior" title="Worship-ready" caption="Bright sanctuary" className="h-56" />
            <PhotoCard slot="volunteers-cleaning" title="Together" caption="Volunteers at work" className="h-56" />
            <PhotoCard slot="cleaning-supplies" className="h-56" />
            <PhotoCard slot="city-sunrise" title="Saturday 9:30 am" caption="Ikeja, Lagos" className="h-56" />
          </div>
          <GlassCard tone="accent" data-role="admin" className="flex items-start gap-3 text-sm">
            <Inbox aria-hidden className="mt-0.5 size-5 shrink-0 text-role-strong" />
            <p>
              Logo placement: full colour on light backgrounds. The artwork has a white-filled ellipse, so it also reads
              on navy without a pill.
            </p>
          </GlassCard>
        </Section>
      </main>
    </div>
  );
}
