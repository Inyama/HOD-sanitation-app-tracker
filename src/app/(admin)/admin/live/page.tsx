import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { isDemoMode } from "@/lib/env";
import { loadLiveBoard } from "@/lib/admin/ops-live";
import { PageHeader } from "@/components/ui/page-header";
import { LiveBoard } from "@/components/admin/LiveBoard";

export const metadata: Metadata = { title: "Live board" };

export default async function LivePage() {
  await requirePage("/admin/live");
  const now = await serverNow();
  const initial = await loadLiveBoard(repo(), now);
  return (
    <>
      <PageHeader
        title="Live Saturday board"
        subtitle="Who has arrived, who is late and who is still expected, while check-in is open."
      />
      <LiveBoard initial={initial} demo={isDemoMode()} />
    </>
  );
}
