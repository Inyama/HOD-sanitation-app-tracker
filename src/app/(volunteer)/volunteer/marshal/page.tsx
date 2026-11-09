import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData } from "@/lib/member/data";
import { formatShort } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MarshalBoard } from "@/components/volunteer/MarshalBoard";

export const metadata: Metadata = { title: "Marshal tools" };

export default async function MarshalPage() {
  const { user } = await requirePage("/volunteer/marshal");
  const now = await serverNow();
  const d = await loadMemberData({ ...user, isRemote: false }, now);
  const meeting = d.nextGeo;
  return (
    <>
      <PageHeader
        title="Marshal tools"
        subtitle={
          meeting
            ? `${meeting.title}, ${formatShort(meeting.startsAt)} (Lagos). Help everyone check in at the gate.`
            : "Help everyone check in at the gate."
        }
      />
      {meeting ? (
        <MarshalBoard meetingId={meeting.id} />
      ) : (
        <EmptyState
          illustration="calendar"
          title="No check-in meeting coming up"
          description="The live lists appear when a Saturday or event is next."
        />
      )}
    </>
  );
}
