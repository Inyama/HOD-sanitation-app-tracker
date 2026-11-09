import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberRows } from "@/lib/admin/data";
import { canRestore } from "@/lib/admin/members";
import { PageHeader } from "@/components/ui/page-header";
import { MembersDirectory } from "@/components/admin/MembersDirectory";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  const { actor } = await requirePage("/admin/members");
  const now = await serverNow();
  const r = repo();
  const [rows, teams, sp] = await Promise.all([
    loadMemberRows(r, now),
    r.teams.list({ orderBy: { field: "name" } }),
    searchParams,
  ]);
  const canManage = can(actor, "people.manage");
  return (
    <>
      <PageHeader
        title="Members"
        subtitle={
          canManage
            ? "Everyone in the unit. Search, filter, add people, or select several to act on them together."
            : "Everyone in the unit. Your admin level can view the directory but not change it."
        }
      />
      <MembersDirectory
        rows={rows.map((m) => ({ ...m, canRestore: canRestore(m, now) }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        canManage={canManage}
        canMessage={can(actor, "messages.send")}
        startAdding={sp.add === "1"}
      />
    </>
  );
}
