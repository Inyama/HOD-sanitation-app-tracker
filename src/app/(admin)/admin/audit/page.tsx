import type { Metadata } from "next";
import { DateTime } from "luxon";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { MEETING_ZONE } from "@/lib/time/zone";
import { nameDirectory } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui/page-header";
import { AuditLogView } from "@/components/admin/AuditLogView";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requirePage("/admin/audit");
  const now = await serverNow();
  const r = repo();
  const [rows, names] = await Promise.all([
    r.audit.list({ orderBy: { field: "createdAt", dir: "desc" } }),
    nameDirectory(r),
  ]);
  const when = Object.fromEntries(
    rows.map((a) => [a.id, DateTime.fromISO(a.createdAt).setZone(MEETING_ZONE).toFormat("ccc d LLL yyyy, HH:mm")]),
  );
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change admins make: who, what, when and from where. Times are Lagos time."
      />
      <AuditLogView
        rows={rows}
        names={[...names.entries()]}
        when={when}
        today={now.setZone(MEETING_ZONE).toISODate()!}
      />
    </>
  );
}
