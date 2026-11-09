import "server-only";
import { requirePage } from "@/lib/auth/session";
import { loadInbox } from "@/lib/member/inbox";
import { formatForViewer } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { Inbox } from "@/components/member/Inbox";

/** Shared by /member/messages and /volunteer/messages; `path` is the page being guarded. */
export async function MessagesScreen({ path }: { path: string }) {
  const { user } = await requirePage(path);
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
