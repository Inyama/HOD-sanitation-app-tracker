import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { lagosDay } from "@/lib/member/display";
import { loadPendingPeople } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui/page-header";
import { ApprovalsBoard } from "@/components/admin/ApprovalsBoard";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  await requirePage("/admin/approvals");
  const { pending, deletionRequests } = await loadPendingPeople(repo());
  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="New sign-ups wait here until an admin approves them. Approving sends a welcome email."
      />
      <ApprovalsBoard
        pending={pending.map(({ createdAt, ...p }) => ({ ...p, createdLabel: lagosDay(createdAt) }))}
        deletions={deletionRequests.map(({ requestedAt, ...d }) => ({ ...d, requestedLabel: lagosDay(requestedAt) }))}
      />
    </>
  );
}
