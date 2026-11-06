"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, CheckCheck, Clock3, Info, Megaphone, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type NotifCategory = "reminders" | "late" | "announcements" | "system";

export interface CenterItem {
  id: string;
  kind: "notification" | "announcement";
  category: NotifCategory;
  title: string;
  body: string;
  at: string;
  atLabel: string;
  read: boolean;
  pinned?: boolean;
}

const FILTERS: { key: "all" | NotifCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reminders", label: "Reminders" },
  { key: "late", label: "Late notices" },
  { key: "announcements", label: "Announcements" },
  { key: "system", label: "System" },
];

const ICON: Record<NotifCategory, typeof Bell> = {
  reminders: Bell,
  late: Clock3,
  announcements: Megaphone,
  system: Info,
};

/** Notification center (spec 7.2): unread dot, mark all read, filter by type. */
export function NotificationCenter({ items: initial }: { items: CenterItem[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [filter, setFilter] = React.useState<"all" | NotifCategory>("all");
  const shown = items.filter((i) => filter === "all" || i.category === filter);
  const unread = items.filter((i) => !i.read).length;

  const markRead = async (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    const r = await apiRequest(`/api/v1/me/notifications/${id}/read`, { method: "PATCH" });
    if (!r.ok) toast.error(r.message);
    router.refresh();
  };
  const markAll = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    const r = await apiRequest<{ marked: number }>("/api/v1/me/notifications/read-all", { body: {} });
    if (r.ok) toast.success(`Marked ${r.marked} as read`);
    else toast.error(r.message);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter notifications" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? unread : items.filter((i) => i.category === f.key && !i.read).length;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium pointer-coarse:h-11",
                  filter === f.key
                    ? "border-role bg-role-soft text-role-strong"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                {count > 0 && (
                  <span className="rounded-full bg-hod-red px-1.5 text-[0.6875rem] font-bold text-white">
                    {count}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={markAll} disabled={unread === 0}>
          <CheckCheck aria-hidden /> Mark all read
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState illustration="inbox" title="Nothing here" description="You are all caught up." />
      ) : (
        <ul
          className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-card"
          aria-label="Notifications"
        >
          {shown.map((n) => {
            const Icon = n.pinned ? Pin : ICON[n.category];
            const content = (
              <>
                <span
                  className={cn(
                    "mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                    n.read ? "bg-muted text-muted-foreground" : "bg-role-soft text-role-strong",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {!n.read && <span aria-hidden className="size-2 shrink-0 rounded-full bg-hod-red" />}
                    <span className={cn("font-semibold", n.read && "font-medium")}>{n.title}</span>
                    {!n.read && <span className="sr-only">(unread)</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{n.atLabel}</span>
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {n.kind === "notification" && !n.read ? (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="flex w-full cursor-pointer gap-3 p-4 text-left hover:bg-muted/50"
                  >
                    {content}
                    <span className="sr-only">, mark as read</span>
                  </button>
                ) : (
                  <div className="flex gap-3 p-4">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
