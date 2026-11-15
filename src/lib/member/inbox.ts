import "server-only";
import type { User } from "@/lib/repo/types";
import { repo } from "@/lib/repo";
import { attendanceViews } from "@/lib/attendance/aggregate";
import { fillMergeFields, firstName } from "@/lib/notifications/templates";
import { now } from "@/lib/time/clock";
import { withRecurringMeetings } from "@/lib/time/schedule";
import { formatShort } from "@/lib/time/zone";

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
  const at = now();
  const all = withRecurringMeetings(meetings, at, 4);
  const view = attendanceViews(records, all, { approvedAt: user.approvedAt, now: at }).overall;
  const next = all.find((m) => m.status !== "CANCELLED" && m.startsAt > at.toUTC().toISO()!);
  const values = {
    first_name: firstName(user.name),
    percentage: view.percent === null ? "–" : String(view.percent),
    band: view.band.label,
    next_meeting: next ? `${next.title}, ${formatShort(next.startsAt)}` : "the next meeting",
  };
  const people = new Map([...users, ...volunteers].map((u) => [u.id, u.name]));
  return recipients
    .map((rec) => {
      const m = messages.find((x) => x.id === rec.messageId);
      if (!m || !m.sentAt) return null;
      return {
        id: m.id,
        subject: fillMergeFields(m.subject, values),
        body: fillMergeFields(m.body, values),
        from: people.get(m.senderId) ?? "Sanitation Unit",
        sentAt: m.sentAt,
        readAt: rec.readAt,
        attachments: m.attachments ?? [],
      } satisfies InboxItem;
    })
    .filter((x): x is InboxItem => x !== null)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
