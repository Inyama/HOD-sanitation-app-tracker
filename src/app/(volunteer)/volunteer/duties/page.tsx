import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { upcomingSaturdays } from "@/lib/volunteer/service";
import { buildDutyBoard, canWithdraw, WITHDRAW_CUTOFF_HOURS } from "@/lib/volunteer/duties";
import { lagosDay } from "@/lib/member/display";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DutyBoard, type BoardMeeting } from "@/components/volunteer/DutyBoard";

export const metadata: Metadata = { title: "Duty board" };

export default async function DutiesPage() {
  const { user } = await requirePage("/volunteer/duties");
  const now = await serverNow();
  const r = repo();
  const [saturdays, zones, duties, users] = await Promise.all([
    upcomingSaturdays(r, now, 2),
    r.zones.list(),
    r.duties.list(),
    r.users.list(),
  ]);
  const meetings: BoardMeeting[] = saturdays.map((m) => ({
    id: m.id,
    label: lagosDay(m.startsAt),
    startsAt: m.startsAt,
    canWithdraw: canWithdraw(now, m.startsAt).ok,
    board: buildDutyBoard(zones, duties, m.id, user.id),
  }));
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  return (
    <>
      <PageHeader
        title="Duty board"
        subtitle={`Choose one zone per Saturday. You can withdraw until ${WITHDRAW_CUTOFF_HOURS} hours before; after that, request a swap and your Team Lead decides.`}
      />
      {meetings.length === 0 ? (
        <EmptyState
          illustration="broom"
          title="No Saturdays to plan"
          description="The next Saturday meetings will appear here."
        />
      ) : (
        <DutyBoard meetings={meetings} names={names} />
      )}
    </>
  );
}
