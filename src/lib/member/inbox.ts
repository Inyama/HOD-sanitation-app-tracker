import "server-only";
import type { User } from "@/lib/repo/types";
import { repo } from "@/lib/repo";
import { attendanceViews } from "@/lib/attendance/aggregate";
import { fillMergeFields, firstName } from "@/lib/notifications/templates";
import { now } from "@/lib/time/clock";

export interface InboxItem {
  id: string;
  subject: string;
  body: string;
  from: string;
  sentAt: string;
  readAt: string | null;
  attachments: { name: string; url: string; size: string }[];
}

/** Messages sent to this person, with merge fields filled in for them. */
export async function loadInbox(user: User): Promise<InboxItem[]> {
  const r = repo();
  const [recipients, messages, users, records, meetings] = await Promise.all([
    r.messageRecipients.list({ where: { userId: user.id } }),
    r.messages.list(),
    r.users.list({ where: { role: "ADMIN" } }),
    r.records.list({ where: { userId: user.id } }),
    r.meetings.list(),
  ]);
  const volunteers = await r.users.list({ where: { role: "VOLUNTEER" } });
  const pct = attendanceViews(records, meetings, { approvedAt: user.approvedAt, now: now() }).overall.percent;
  const people = new Map([...users, ...volunteers].map((u) => [u.id, u.name]));
  return recipients
    .map((rec) => {
      const m = messages.find((x) => x.id === rec.messageId);
      if (!m || !m.sentAt) return null;
      return {
        id: m.id,
        subject: m.subject,
        body: fillMergeFields(m.body, {
          first_name: firstName(user.name),
          percentage: pct === null ? "–" : String(pct),
        }),
        from: people.get(m.senderId) ?? "Sanitation Unit",
        sentAt: m.sentAt,
        readAt: rec.readAt,
        attachments: m.attachments ?? [],
      } satisfies InboxItem;
    })
    .filter((x): x is InboxItem => x !== null)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
