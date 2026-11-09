import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { teamStats } from "@/lib/volunteer/service";
import { lagosDay } from "@/lib/member/display";
import { PageHeader } from "@/components/ui/page-header";
import { TeamView, type TeamBlock } from "@/components/volunteer/TeamView";

export const metadata: Metadata = { title: "My team" };

export default async function TeamPage() {
  const { user } = await requirePage("/volunteer/team");
  const now = await serverNow();
  const r = repo();
  const [stats, zones, meetings] = await Promise.all([teamStats(r, user, now), r.zones.list(), r.meetings.list()]);
  const teams: TeamBlock[] = stats.map((t) => ({
    id: t.id,
    name: t.name,
    members: t.members.map((m) => ({
      id: m.id,
      name: m.name,
      isLead: m.isLead,
      isMe: m.id === user.id,
      percent: m.percent,
      band: m.band,
      last: m.last.map((x) => ({ dateLabel: lagosDay(x.date).replace(/^\w+ /, ""), status: x.status })),
    })),
    swapRequests: t.swapRequests.map((s) => {
      const meeting = meetings.find((m) => m.id === s.meetingId);
      const zone = zones.find((z) => z.id === s.zoneId);
      return {
        dutyId: s.dutyId,
        name: s.name,
        label: `${zone?.name ?? "their zone"} on ${meeting ? lagosDay(meeting.startsAt) : "Saturday"}`,
      };
    }),
  }));
  return (
    <>
      <PageHeader title="My team" subtitle="See how your team is doing, cheer people on, and decide duty swaps." />
      <TeamView teams={teams} />
    </>
  );
}
