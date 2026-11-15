import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { loadRoster } from "@/lib/admin/ops-roster";
import { PageHeader } from "@/components/ui/page-header";
import { RosterBoard } from "@/components/admin/RosterBoard";

export const metadata: Metadata = { title: "Duty roster" };

export default async function DutiesPage({ searchParams }: PageProps<"/admin/duties">) {
  await requirePage("/admin/duties");
  const now = await serverNow();
  const id = (await searchParams).meetingId;
  const data = await loadRoster(repo(), now, typeof id === "string" ? id : undefined);
  return (
    <>
      <PageHeader
        title="Duty roster and zones"
        subtitle="Place volunteers in zones for a Saturday, then publish so each person gets their zone and arrival time."
      />
      {/* Remount when the suggestions change so the ticked suggestions start fresh. */}
      <RosterBoard
        key={`${data.meeting?.id ?? "none"}:${data.suggestions.map((s) => s.userId + s.zoneId).join(",")}`}
        data={data}
      />
    </>
  );
}
