import type { Metadata } from "next";
import { Users, UserCheck, TriangleAlert, HeartHandshake } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { firstName } from "@/lib/notifications/templates";
import { ADMIN_LEVEL_LABELS } from "@/lib/repo/types";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/KpiCard";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminHome() {
  const { user } = await requirePage("/admin");
  const r = repo();
  const [members, volunteers, pending, urgent] = await Promise.all([
    r.users.count({ where: { status: "ACTIVE", role: "MEMBER" } }),
    r.users.count({ where: { status: "ACTIVE", role: "VOLUNTEER" } }),
    r.users.count({ where: { status: "PENDING" } }),
    r.issues.count({ where: { status: "OPEN", urgency: "URGENT" } }),
  ]);
  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName(user.name)}`}
        subtitle={`Signed in as ${user.adminLevel ? ADMIN_LEVEL_LABELS[user.adminLevel] : "Admin"} with two-factor. The full dashboard arrives in Phase 5.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active members" value={String(members)} icon={<Users className="size-4" />} />
        <KpiCard label="Volunteers" value={String(volunteers)} icon={<HeartHandshake className="size-4" />} />
        <KpiCard label="Pending approvals" value={String(pending)} icon={<UserCheck className="size-4" />} />
        <KpiCard label="Urgent open issues" value={String(urgent)} icon={<TriangleAlert className="size-4" />} />
      </div>
    </>
  );
}
