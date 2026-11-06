"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Inbox, RefreshCw } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface Email {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  sentAt: string;
}

/** Demo-only view of emails "sent" by the console sender, newest first. Links inside work. */
export function Outbox() {
  const q = useQuery({
    queryKey: ["outbox"],
    queryFn: async () => {
      const res = await fetch("/api/v1/demo/outbox");
      if (!res.ok) throw new Error("The outbox is only available in demo mode.");
      return (await res.json()).items as Email[];
    },
    refetchInterval: 5000,
  });
  const [selected, setSelected] = React.useState<string | null>(null);
  const items = q.data ?? [];
  const current = items.find((e) => e.id === selected) ?? items[0];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg">
        <div className="demo-pad mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <Link href="/">
            <Logo size={36} withWordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">
                <ArrowLeft aria-hidden /> Sign in
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 py-8 outline-none sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold sm:text-[2rem]">
              <Inbox aria-hidden className="size-7 text-role-strong" /> Demo email outbox
            </h1>
            <p className="mt-1 text-muted-foreground">
              Emails the app would send. Nothing leaves this computer in demo mode; the list clears when the server
              restarts.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            <RefreshCw aria-hidden /> Refresh
          </Button>
        </div>
        {q.isLoading ? (
          <LoadingState rows={4} label="Loading emails" />
        ) : q.isError ? (
          <ErrorState description={(q.error as Error).message} />
        ) : items.length === 0 ? (
          <EmptyState
            illustration="inbox"
            title="No emails yet"
            description="Sign up, ask for a password reset, or sign in from a new browser, and the email appears here."
            action={
              <Button asChild variant="role">
                <Link href="/signup/member">Try signing up</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <ul
              aria-label="Emails"
              className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-card"
            >
              {items.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e.id)}
                    aria-current={current?.id === e.id ? "true" : undefined}
                    className={cn(
                      "block w-full cursor-pointer px-4 py-3 text-left hover:bg-muted/60",
                      current?.id === e.id && "bg-role-soft",
                    )}
                  >
                    <span className="block truncate text-sm font-semibold">{e.subject}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      To {e.to} ·{" "}
                      {new Date(e.sentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {current && (
              <section aria-label={`Email: ${current.subject}`} className="space-y-3">
                <div className="rounded-(--radius-md) border border-border bg-card p-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">To:</span> {current.to}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Subject:</span>{" "}
                    <span className="font-semibold">{current.subject}</span>
                  </p>
                  {(() => {
                    const link = current.text.match(/https?:\/\/\S+/)?.[0];
                    if (!link) return null;
                    const path = link.replace(/^https?:\/\/[^/]+/, "");
                    return (
                      <p className="mt-2">
                        <Link href={path} className="font-semibold text-role-strong underline">
                          Open the link in this email
                        </Link>
                      </p>
                    );
                  })()}
                </div>
                <iframe
                  title={`Preview of ${current.subject}`}
                  srcDoc={current.html}
                  sandbox=""
                  className="h-[640px] w-full rounded-(--radius-md) border border-border bg-white"
                />
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
