import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { formatShort } from "@/lib/time/zone";
import { lagosClock } from "@/lib/member/display";
import { loadCorrections, type CorrectionsData } from "@/lib/admin/ops-corrections";
import { PageHeader } from "@/components/ui/page-header";
import { CorrectionsBoard, type RecordItem } from "@/components/admin/CorrectionsBoard";

export const metadata: Metadata = { title: "Corrections" };

const record = (r: CorrectionsData["flagged"][number]): RecordItem => ({
  ...r,
  meeting: {
    id: r.meeting.id,
    title: r.meeting.title,
    label: r.meeting.startsAt ? formatShort(r.meeting.startsAt) : "",
  },
  timeLabel: lagosClock(r.checkedInAt),
});

export default async function CorrectionsPage() {
  await requirePage("/admin/corrections");
  const now = await serverNow();
  const d = await loadCorrections(repo(), now);
  return (
    <>
      <PageHeader
        title="Corrections and disputes"
        subtitle="Flagged and manual check-ins, and members' queries. A record changes only with a reason."
      />
      <CorrectionsBoard
        flagged={d.flagged.map(record)}
        manual={d.manual.map(record)}
        disputes={d.disputes.map((x) => ({
          ...x,
          createdLabel: formatShort(x.createdAt),
          meeting: {
            id: x.meeting.id,
            title: x.meeting.title,
            label: x.meeting.startsAt ? formatShort(x.meeting.startsAt) : "",
          },
          record: x.record
            ? { status: x.record.status, method: x.record.method, timeLabel: lagosClock(x.record.checkedInAt) }
            : null,
        }))}
        history={d.history
          .filter((h) => h.after)
          .map((h) => ({
            id: h.id,
            atLabel: formatShort(h.at),
            by: h.by,
            person: h.after?.person ?? null,
            meeting: h.after?.meeting ?? null,
            before: h.before ? { status: h.before.status, timeLabel: lagosClock(h.before.checkedInAt) } : null,
            after: { status: h.after!.status, timeLabel: lagosClock(h.after!.checkedInAt) },
            reason: h.after?.reason ?? null,
          }))}
      />
    </>
  );
}
