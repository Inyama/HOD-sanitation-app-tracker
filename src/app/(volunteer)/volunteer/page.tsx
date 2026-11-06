import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Award } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { attendanceViews } from "@/lib/attendance/aggregate";
import { serverNow } from "@/lib/time/server-now";
import { firstName } from "@/lib/notifications/templates";
import { TITLE_LABELS } from "@/lib/repo/types";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Volunteer home" };

export default async function VolunteerHome() {
  const { user, titles } = await requirePage("/volunteer");
  const r = repo();
  const [records, meetings, hours] = await Promise.all([
    r.records.list({ where: { userId: user.id } }),
    r.meetings.list(),
    r.serviceHours.list({ where: { userId: user.id } }),
  ]);
  const views = attendanceViews(records, meetings, { approvedAt: user.approvedAt, now: serverNow() });
  const verified = hours.filter((h) => h.source === "AUTO" || h.verifiedById).reduce((s, h) => s + h.hours, 0);

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName(user.name)}`}
        subtitle="You are signed in as a volunteer. Duties, events and hours arrive in Phase 4."
        actions={
          <Button asChild variant="role">
            <Link href="/member">My member view</Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="flex flex-col items-center justify-center">
          <AttendanceRing percent={views.overall.percent} label="Overall" />
        </GlassCard>
        <GlassCard className="flex flex-col gap-2">
          <Clock3 aria-hidden className="size-5 text-role-strong" />
          <p className="text-sm text-muted-foreground">Verified service hours</p>
          <p className="tabular font-heading text-3xl font-semibold">{verified}</p>
        </GlassCard>
        <GlassCard className="flex flex-col gap-2">
          <Award aria-hidden className="size-5 text-role-strong" />
          <p className="text-sm text-muted-foreground">Your titles</p>
          <p className="font-semibold">{titles.length ? titles.map((t) => TITLE_LABELS[t]).join(", ") : "None yet"}</p>
        </GlassCard>
      </div>
    </>
  );
}
