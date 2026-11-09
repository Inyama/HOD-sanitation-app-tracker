import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { repo } from "@/lib/repo";
import type { TitleCode } from "@/lib/repo/types";
import { PageHeader } from "@/components/ui/page-header";
import { RolesManager, type RolePerson } from "@/components/admin/RolesManager";

export const metadata: Metadata = { title: "Roles and titles" };

export default async function RolesPage({ searchParams }: PageProps<"/admin/roles">) {
  const { user, actor } = await requirePage("/admin/roles");
  const r = repo();
  const [users, titles, teams, members, sp] = await Promise.all([
    r.users.list({ whereIn: { status: ["ACTIVE", "SUSPENDED"] }, orderBy: { field: "name" } }),
    r.userTitles.list(),
    r.teams.list(),
    r.teamMembers.list(),
    searchParams,
  ]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const teamOf = new Map(members.map((m) => [m.userId, m.teamId]));
  const people: RolePerson[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    adminLevel: u.adminLevel,
    titles: titles.filter((t) => t.userId === u.id).map((t) => t.title as TitleCode),
    teamName: teamOf.has(u.id) ? (teamName.get(teamOf.get(u.id)!) ?? null) : null,
    status: u.status as "ACTIVE" | "SUSPENDED",
    isMe: u.id === user.id,
  }));
  return (
    <>
      <PageHeader
        title="Roles and titles"
        subtitle="Choose each person's role and volunteer titles. You will see what they gain or lose before you confirm."
      />
      <RolesManager
        people={people}
        canAdminLevels={can(actor, "roles.assignAdminLevel")}
        focusId={typeof sp.person === "string" ? sp.person : undefined}
      />
    </>
  );
}
