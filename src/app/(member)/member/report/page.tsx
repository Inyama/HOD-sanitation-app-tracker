import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { serverNow } from "@/lib/time/server-now";
import { PageHeader } from "@/components/ui/page-header";
import { ReportBuilder } from "@/components/member/ReportBuilder";

export const metadata: Metadata = { title: "My report" };

export default async function ReportPage() {
  await requirePage("/member/report");
  const now = await serverNow();
  return (
    <>
      <PageHeader
        title="My report"
        subtitle="A statement of your attendance for any period, as a PDF with the unit logo."
      />
      <ReportBuilder today={now.setZone("Africa/Lagos").toISODate()!} />
    </>
  );
}
