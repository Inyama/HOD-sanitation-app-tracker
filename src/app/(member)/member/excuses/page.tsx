import type { Metadata } from "next";
import { DateTime } from "luxon";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData } from "@/lib/member/data";
import { canSubmitExcuse } from "@/lib/attendance/excuses";
import { formatShort, formatForViewer } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { ExcuseRequests, type EligibleMeeting, type ExcuseItem } from "@/components/member/ExcuseRequests";

export const metadata: Metadata = { title: "Excuse requests" };

export default async function ExcusesPage() {
  const { user } = await requirePage("/member/excuses");
  const now = await serverNow();
  const d = await loadMemberData(user, now);
  const excuses = await repo().excuses.list({
    where: { userId: user.id },
    orderBy: { field: "createdAt", dir: "desc" },
  });
  const meetingLabel = (id: string) => {
    const m = d.meetings.find((x) => x.id === id);
    return m ? `${m.title}, ${formatShort(m.startsAt)}` : id;
  };
  const items: ExcuseItem[] = excuses.map((e) => ({
    id: e.id,
    meetingLabel: meetingLabel(e.meetingId),
    reason: e.reason,
    status: e.status,
    reviewNote: e.reviewNote,
    createdLabel: formatForViewer(e.createdAt, user.timezone),
    proofUrl: e.proofUrl,
  }));
  const taken = new Set(excuses.filter((e) => e.status !== "DECLINED").map((e) => e.meetingId));
  const approved = user.approvedAt ? DateTime.fromISO(user.approvedAt) : null;
  const eligible: EligibleMeeting[] = d.meetings
    .filter((m) => m.status !== "CANCELLED" && canSubmitExcuse(now, m.startsAt).ok)
    .filter((m) => !(user.isRemote && m.type === "SATURDAY"))
    .filter((m) => approved && DateTime.fromISO(m.startsAt) >= approved)
    .filter((m) => !taken.has(m.id))
    .filter((m) => {
      const rec = d.records.find((r) => r.meetingId === m.id);
      return !(rec && (rec.status === "ON_TIME" || rec.status === "LATE"));
    })
    .map((m) => ({
      id: m.id,
      label: `${m.title}, ${formatShort(m.startsAt)}${DateTime.fromISO(m.startsAt) < now ? " (past)" : ""}`,
    }));

  return (
    <>
      <PageHeader title="Excuse requests" subtitle="Let the unit know when you cannot attend." />
      <ExcuseRequests items={items} eligible={eligible} />
    </>
  );
}
