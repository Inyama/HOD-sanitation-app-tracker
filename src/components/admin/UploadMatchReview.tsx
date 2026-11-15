"use client";

import * as React from "react";
import { Check, CircleAlert, Copy, Loader2, SearchX, Undo2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Resolution } from "@/lib/matching/upload";
import { cn } from "@/lib/utils";

/** Plain shape of one preview row (from GET /api/v1/admin/uploads/:id/preview). */
export interface ReviewRow {
  id: string;
  index: number;
  name: string;
  email: string | null;
  time: string | null;
  matchType: "EMAIL" | "NAME_SUGGESTED" | "NOT_FOUND" | "DUPLICATE";
  similarity: number | null;
  matchedUserId: string | null;
  matchedName: string | null;
  warning: "PENDING_ACCOUNT" | "SUSPENDED_ACCOUNT" | null;
  duplicateOf: number | null;
  resolution: Resolution | null;
}

export interface ReviewPerson {
  id: string;
  name: string;
  email: string;
  status: string;
}

const TABS = [
  { key: "EMAIL", label: "Matched" },
  { key: "NAME_SUGGESTED", label: "Suggested" },
  { key: "NOT_FOUND", label: "Not found" },
  { key: "DUPLICATE", label: "Duplicates" },
] as const;

const WARNING = {
  PENDING_ACCOUNT: "Account still pending approval",
  SUSPENDED_ACCOUNT: "Account suspended",
} as const;

function decisionText(r: ReviewRow, people: Map<string, ReviewPerson>): { text: string; tone: "ok" | "skip" | "todo" } {
  if (r.matchType === "DUPLICATE")
    return { text: `Repeats row ${(r.duplicateOf ?? 0) + 2}; counted once`, tone: "skip" };
  const res = r.resolution ?? (r.matchType === "EMAIL" ? { kind: "ACCEPT" as const } : null);
  if (!res)
    return {
      text: r.matchType === "NAME_SUGGESTED" ? "Needs your decision" : "Will be skipped unless you assign someone",
      tone: r.matchType === "NAME_SUGGESTED" ? "todo" : "skip",
    };
  if (res.kind === "IGNORE") return { text: "Skipped", tone: "skip" };
  if (res.kind === "ASSIGN") return { text: `Assigned to ${people.get(res.userId)?.name ?? "someone"}`, tone: "ok" };
  return { text: `Present: ${r.matchedName ?? "matched person"}`, tone: "ok" };
}

/**
 * Match preview tabs (spec 6.4, 7.4 item 6): Matched, Suggested, Not found, Duplicates.
 * Suggested rows must be accepted or ignored; Not found rows can be assigned to a person.
 */
export function UploadMatchReview({
  rows,
  people,
  readOnly = false,
  onResolve,
}: {
  rows: ReviewRow[];
  people: ReviewPerson[];
  readOnly?: boolean;
  onResolve: (row: ReviewRow, resolution: Resolution | null) => Promise<void> | void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [assigning, setAssigning] = React.useState<Record<string, string>>({});
  const byId = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, rows.filter((r) => r.matchType === t.key).length]),
  ) as Record<(typeof TABS)[number]["key"], number>;
  const waiting = rows.filter((r) => r.matchType === "NAME_SUGGESTED" && !r.resolution).length;
  const firstTab = waiting ? "NAME_SUGGESTED" : counts.NOT_FOUND ? "NOT_FOUND" : "EMAIL";

  const act = async (r: ReviewRow, res: Resolution | null) => {
    setBusy(r.id);
    try {
      await onResolve(r, res);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Tabs defaultValue={firstTab}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="min-h-10 gap-1.5">
            {t.label} <span className="tabular rounded-full bg-muted px-1.5 text-xs">{counts[t.key]}</span>
            {t.key === "NAME_SUGGESTED" && waiting > 0 && (
              <>
                {" "}
                <span className="text-xs font-semibold text-(--status-late-fg)">({waiting} to decide)</span>
              </>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => {
        const list = rows.filter((r) => r.matchType === t.key);
        return (
          <TabsContent key={t.key} value={t.key} className="mt-3">
            {list.length === 0 ? (
              <p className="rounded-(--radius-md) border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {t.key === "EMAIL" ? "No rows matched by email." : `No ${t.label.toLowerCase()} rows.`}
              </p>
            ) : (
              <ul
                aria-label={`${t.label} rows`}
                className="divide-y divide-border rounded-(--radius-md) border border-border"
              >
                {list.map((r) => {
                  const d = decisionText(r, byId);
                  return (
                    <li key={r.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="text-xs text-muted-foreground">Row {r.index + 2}</span>
                          <span className="font-semibold">{r.name || "(no name)"}</span>
                          <span className="truncate text-muted-foreground">{r.email ?? "no email"}</span>
                          {r.time && <span className="text-xs text-muted-foreground">at {r.time}</span>}
                        </p>
                        {r.matchType === "NAME_SUGGESTED" && r.matchedName && (
                          <p className="mt-1 text-sm">
                            Looks like <strong>{r.matchedName}</strong>
                            {r.similarity !== null && (
                              <span className="text-muted-foreground">
                                {" "}
                                ({Math.round(r.similarity * 100)}% similar name)
                              </span>
                            )}
                          </p>
                        )}
                        {r.warning && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-(--status-late-fg)">
                            <CircleAlert aria-hidden className="size-3.5" /> {WARNING[r.warning]}
                          </p>
                        )}
                        <p
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                            d.tone === "ok" && "text-(--status-ontime-fg)",
                            d.tone === "todo" && "text-(--status-late-fg)",
                            d.tone === "skip" && "text-muted-foreground",
                          )}
                        >
                          {d.tone === "ok" ? (
                            <Check aria-hidden className="size-3.5" />
                          ) : d.tone === "todo" ? (
                            <CircleAlert aria-hidden className="size-3.5" />
                          ) : r.matchType === "DUPLICATE" ? (
                            <Copy aria-hidden className="size-3.5" />
                          ) : (
                            <SearchX aria-hidden className="size-3.5" />
                          )}
                          {d.text}
                        </p>
                      </div>
                      {!readOnly && r.matchType !== "DUPLICATE" && (
                        <div className="flex flex-wrap items-center gap-2">
                          {busy === r.id && <Loader2 aria-label="Saving" className="size-4 animate-spin" />}
                          {r.matchType === "NAME_SUGGESTED" && (
                            <>
                              <Button
                                size="sm"
                                variant={r.resolution?.kind === "ACCEPT" ? "role" : "outline"}
                                disabled={busy !== null}
                                aria-pressed={r.resolution?.kind === "ACCEPT"}
                                onClick={() => act(r, { kind: "ACCEPT" })}
                                aria-label={`Confirm ${r.name} is ${r.matchedName}`}
                              >
                                <Check aria-hidden /> Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant={r.resolution?.kind === "IGNORE" ? "secondary" : "outline"}
                                disabled={busy !== null}
                                aria-pressed={r.resolution?.kind === "IGNORE"}
                                onClick={() => act(r, { kind: "IGNORE" })}
                                aria-label={`Skip row ${r.index + 2}`}
                              >
                                <X aria-hidden /> Skip
                              </Button>
                            </>
                          )}
                          {(r.matchType === "NOT_FOUND" || r.matchType === "NAME_SUGGESTED") && (
                            <div className="flex items-center gap-2">
                              <NativeSelect
                                aria-label={`Assign row ${r.index + 2} to a person`}
                                className="h-10 w-48"
                                value={assigning[r.id] ?? (r.resolution?.kind === "ASSIGN" ? r.resolution.userId : "")}
                                onChange={(e) => setAssigning((a) => ({ ...a, [r.id]: e.target.value }))}
                              >
                                <option value="">Choose a person…</option>
                                {people.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p.status !== "ACTIVE" ? ` (${p.status.toLowerCase()})` : ""}
                                  </option>
                                ))}
                              </NativeSelect>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy !== null || !assigning[r.id]}
                                onClick={() => act(r, { kind: "ASSIGN", userId: assigning[r.id] })}
                              >
                                <UserPlus aria-hidden /> Assign
                              </Button>
                            </div>
                          )}
                          {r.resolution && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy !== null}
                              onClick={() => act(r, null)}
                              aria-label={`Undo the decision on row ${r.index + 2}`}
                            >
                              <Undo2 aria-hidden /> Undo
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
