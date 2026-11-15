import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { formatShort } from "@/lib/time/zone";
import { loadExcuseQueue, type ExcuseRow } from "@/lib/admin/ops-excuses";
import { PageHeader } from "@/components/ui/page-header";
import { ExcuseQueue, type ExcuseItem } from "@/components/admin/ExcuseQueue";

export const metadata: Metadata = { title: "Excuse requests" };

const toItem = (e: ExcuseRow): ExcuseItem => ({
  ...e,
  createdLabel: formatShort(e.createdAt),
  meeting: { id: e.meeting.id, title: e.meeting.title, label: formatShort(e.meeting.startsAt), held: e.meeting.held },
});

export default async function ExcusesPage() {
  await requirePage("/admin/excuses");
  const now = await serverNow();
  const { pending, decided } = await loadExcuseQueue(repo(), now);
  return (
    <>
      <PageHeader
        title="Excuse requests"
        subtitle="Approving turns an absence into Excused, so it no longer counts against the person. Declined stays Absent."
      />
      <ExcuseQueue pending={pending.map(toItem)} decided={decided.map(toItem)} />
    </>
  );
}
