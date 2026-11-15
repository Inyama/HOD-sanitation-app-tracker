"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RichText } from "@/components/ui/rich-text";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface InboxRow {
  id: string;
  subject: string;
  body: string;
  from: string;
  sentLabel: string;
  read: boolean;
  attachments: { name: string; url: string; size: string }[];
}

/** Messages from admins (spec 7.2): search, read state and attachments. */
export function Inbox({ items: initial }: { items: InboxRow[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((m) => !needle || `${m.subject} ${m.body} ${m.from}`.toLowerCase().includes(needle));
  const current = items.find((m) => m.id === openId) ?? null;

  const open = async (m: InboxRow) => {
    setOpenId(m.id);
    if (!m.read) {
      setItems((xs) => xs.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
      await apiRequest(`/api/v1/me/messages/${m.id}/read`, { method: "PATCH" });
      router.refresh();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className={cn("space-y-3", current && "hidden lg:block")}>
        <div className="relative">
          <label htmlFor="msg-search" className="sr-only">
            Search messages
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="msg-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages"
            className="pl-9"
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {shown.length} message{shown.length === 1 ? "" : "s"}
        </p>
        {shown.length === 0 ? (
          <EmptyState
            illustration="inbox"
            title={items.length ? "No messages match" : "No messages yet"}
            description={items.length ? "Try another word." : "Messages from unit leaders appear here."}
          />
        ) : (
          <ul
            className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-card"
            aria-label="Messages"
          >
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => open(m)}
                  aria-current={openId === m.id ? "true" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer gap-3 p-4 text-left hover:bg-muted/50",
                    openId === m.id && "bg-role-soft",
                  )}
                >
                  <UserAvatar name={m.from} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {!m.read && <span aria-hidden className="size-2 shrink-0 rounded-full bg-hod-red" />}
                      <span className={cn("truncate", m.read ? "font-medium" : "font-semibold")}>{m.subject}</span>
                      {!m.read && <span className="sr-only">(unread)</span>}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {m.from} · {m.sentLabel}
                    </span>
                  </span>
                  {m.attachments.length > 0 && (
                    <Paperclip aria-label="Has an attachment" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <section
        aria-label="Message"
        className={cn(
          "rounded-(--radius-lg) border border-border bg-card p-5 shadow-soft",
          !current && "hidden lg:block",
        )}
      >
        {current ? (
          <article className="space-y-4">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOpenId(null)}>
              <ArrowLeft aria-hidden /> All messages
            </Button>
            <header className="flex items-start gap-3">
              <UserAvatar name={current.from} size={44} />
              <div>
                <h2 className="text-xl font-semibold">{current.subject}</h2>
                <p className="text-sm text-muted-foreground">
                  From {current.from} · {current.sentLabel}
                </p>
              </div>
            </header>
            <RichText text={current.body} />
            {current.attachments.length > 0 && (
              <ul className="space-y-2" aria-label="Attachments">
                {current.attachments.map((a) => (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      download
                      className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-sm) border border-border px-3 text-sm font-medium hover:border-role"
                    >
                      <Paperclip aria-hidden className="size-4" /> {a.name}{" "}
                      <span className="text-muted-foreground">({a.size})</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : (
          <EmptyState
            illustration="inbox"
            title="Choose a message"
            description="Select a message on the left to read it."
          />
        )}
      </section>
    </div>
  );
}
