import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { formatForViewer } from "@/lib/time/zone";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationCenter, type CenterItem, type NotifCategory } from "@/components/member/NotificationCenter";

export const metadata: Metadata = { title: "Notifications" };

function categoryOf(type: string): NotifCategory {
  if (type === "SAT_LATE_NOTICE" || type === "SAT_WINDOW_CLOSING") return "late";
  if (type.startsWith("SAT_") || type.startsWith("THU_") || type.startsWith("EVENT_")) return "reminders";
  if (type === "ANNOUNCEMENT") return "announcements";
  return "system";
}

export default async function NotificationsPage() {
  const { user } = await requirePage("/member/notifications");
  const r = repo();
  const [notifications, announcements] = await Promise.all([
    r.notifications.list({ where: { userId: user.id, channel: "IN_APP" } }),
    r.announcements.list(),
  ]);
  const merged: CenterItem[] = [
    ...notifications.map((n) => ({
      id: n.id,
      kind: "notification" as const,
      category: categoryOf(n.type),
      title: n.title,
      body: n.body,
      at: n.scheduledFor,
      atLabel: formatForViewer(n.scheduledFor, user.timezone),
      read: !!n.readAt,
    })),
    ...announcements.map((a) => ({
      id: a.id,
      kind: "announcement" as const,
      category: "announcements" as const,
      title: a.title,
      body: a.body,
      at: a.createdAt,
      atLabel: formatForViewer(a.createdAt, user.timezone),
      read: true,
      pinned: a.pinned,
    })),
  ];
  const items = merged.sort(
    (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.at.localeCompare(a.at),
  );

  return (
    <>
      <PageHeader title="Notifications" subtitle="Reminders, late notices, announcements and account messages." />
      <NotificationCenter items={items} />
    </>
  );
}
