import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { loadInbox } from "@/lib/member/inbox";
import { formatForViewer } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { Inbox } from "@/components/member/Inbox";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { user } = await requirePage("/member/messages");
  const items = (await loadInbox(user)).map((m) => ({
    id: m.id,
    subject: m.subject,
    body: m.body,
    from: m.from,
    sentLabel: formatForViewer(m.sentAt, user.timezone),
    read: !!m.readAt,
    attachments: m.attachments,
  }));
  return (
    <>
      <PageHeader title="Messages" subtitle="Messages from unit leaders." />
      <Inbox items={items} />
    </>
  );
}
