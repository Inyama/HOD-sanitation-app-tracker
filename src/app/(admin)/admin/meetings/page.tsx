import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { loadMeetingsScreen } from "@/lib/admin/ops-meetings";
import { PageHeader } from "@/components/ui/page-header";
import { MeetingsScreen } from "@/components/admin/MeetingsScreen";

export const metadata: Metadata = { title: "Meetings and events" };

export default async function MeetingsPage({ searchParams }: PageProps<"/admin/meetings">) {
  await requirePage("/admin/meetings");
  const now = await serverNow();
  const month = (await searchParams).month;
  const data = await loadMeetingsScreen(
    repo(),
    now,
    typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
  );
  return (
    <>
      <PageHeader
        title="Meetings and events"
        subtitle="Weekly meetings repeat on their own. Add special events, and cancel or move a meeting with automatic notices."
      />
      <MeetingsScreen data={data} />
    </>
  );
}
