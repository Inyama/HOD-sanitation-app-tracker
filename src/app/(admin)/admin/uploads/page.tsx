import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { formatShort } from "@/lib/time/zone";
import { uploadableMeetings, uploadHistory } from "@/lib/admin/ops-uploads";
import { PageHeader } from "@/components/ui/page-header";
import { UploadsScreen } from "@/components/admin/UploadsScreen";

export const metadata: Metadata = { title: "Sheet uploads" };

export default async function UploadsPage({ searchParams }: PageProps<"/admin/uploads">) {
  await requirePage("/admin/uploads");
  const now = await serverNow();
  const r = repo();
  const [meetings, history, records] = await Promise.all([
    uploadableMeetings(r, now),
    uploadHistory(r),
    r.records.list({ where: { method: "SHEET" } }),
  ]);
  const withSheet = new Set(records.map((x) => x.meetingId));
  const resume = (await searchParams).upload;
  const resumeId =
    typeof resume === "string" && history.some((h) => h.id === resume && h.status === "PREVIEW") ? resume : null;
  return (
    <>
      <PageHeader
        title="Attendance upload"
        subtitle="Upload a Thursday prayer sheet (or any meeting's list), check the matches, then confirm."
      />
      <UploadsScreen
        meetings={meetings.map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          label: `${m.title}, ${formatShort(m.startsAt)}`,
          hasSheet: withSheet.has(m.id),
        }))}
        history={history.map((h) => ({
          id: h.id,
          originalName: h.originalName,
          meetingTitle: h.meetingTitle,
          meetingLabel: h.meetingStart ? formatShort(h.meetingStart) : "",
          uploader: h.uploader,
          uploadedLabel: formatShort(h.uploadedAt),
          status: h.status,
          rowsTotal: h.rowsTotal,
          rowsMatched: h.rowsMatched,
          rowsException: h.rowsException,
          rolledBackLabel: h.rolledBackAt ? formatShort(h.rolledBackAt) : null,
        }))}
        initialResume={resumeId}
      />
    </>
  );
}
