import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { formatForViewer } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { IssueReporter, type IssueItem } from "@/components/volunteer/IssueReporter";

export const metadata: Metadata = { title: "Report an issue" };

export default async function IssuesPage() {
  const { user } = await requirePage("/volunteer/issues");
  const issues = await repo().issues.list({
    where: { reporterId: user.id },
    orderBy: { field: "createdAt", dir: "desc" },
  });
  const items: IssueItem[] = issues.map((i) => ({
    id: i.id,
    area: i.area,
    urgency: i.urgency,
    note: i.note,
    status: i.status,
    photoUrl: i.photoUrl,
    createdLabel: formatForViewer(i.createdAt, user.timezone),
  }));
  return (
    <>
      <PageHeader
        title="Report an issue"
        subtitle="Tell the admins about anything that needs fixing. Urgent safety issues go to the top of their list."
      />
      <IssueReporter items={items} />
    </>
  );
}
