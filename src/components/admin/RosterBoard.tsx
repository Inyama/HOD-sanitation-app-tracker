"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock3, GripVertical, Loader2, Megaphone, Repeat, Sparkles, UserMinus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/api-client";
import type { RosterData } from "@/lib/admin/ops-roster";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";

const POOL = "__pool__";

function PersonChip({
  name,
  userId,
  detail,
  zones,
  currentZone,
  disabled,
  onMove,
}: {
  name: string;
  userId: string;
  detail?: string;
  zones: { id: string; name: string }[];
  currentZone: string | null;
  disabled?: boolean;
  onMove: (userId: string, zoneId: string) => void;
}) {
  return (
    <li
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", userId);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "flex items-center gap-2 rounded-(--radius-md) border border-border bg-card px-2 py-1.5 text-sm shadow-soft",
        disabled ? "opacity-60" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <GripVertical aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      {!disabled && (
        <NativeSelect
          aria-label={`Move ${name} to`}
          className="h-9 w-32 shrink-0 text-xs"
          value={currentZone ?? POOL}
          onChange={(e) => onMove(userId, e.target.value)}
        >
          <option value={POOL}>{currentZone ? "Take off roster" : "Not placed"}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </li>
  );
}

/** Duty roster and zones (spec 7.4 item 14): drag-and-drop board, auto-suggest, publish, swaps. */
export function RosterBoard({ data }: { data: RosterData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<number>>(() => new Set(data.suggestions.map((_, i) => i)));
  const [publishing, setPublishing] = React.useState(false);

  if (!data.meeting)
    return (
      <GlassCard>
        <EmptyState
          illustration="calendar"
          title="No Saturday coming up"
          description="The roster opens for the next four Saturdays."
        />
      </GlassCard>
    );
  const meeting = data.meeting;

  const call = async (body: Record<string, unknown>, success?: string) => {
    setBusy(true);
    const r = await apiRequest<{ added?: number; skipped?: string[]; told?: number }>("/api/v1/admin/roster", {
      method: "PUT",
      body,
    });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message);
      return false;
    }
    if (success)
      toast.success(success, {
        description: r.skipped?.length ? `${r.skipped.length} skipped: ${r.skipped[0]}` : undefined,
      });
    router.refresh();
    return true;
  };

  const dutyOf = new Map(data.current.filter((d) => d.status !== "SWAPPED").map((d) => [d.userId, d]));
  const move = (userId: string, zoneId: string) => {
    const duty = dutyOf.get(userId);
    if (zoneId === POOL) {
      if (duty) void call({ action: "remove", dutyId: duty.id }, "Taken off the roster");
      return;
    }
    if (duty?.zoneId === zoneId) return;
    void call(
      { action: "assign", meetingId: meeting.id, userId, zoneId },
      `Placed in ${data.zones.find((z) => z.id === zoneId)?.name}`,
    );
  };
  const drop = (zoneId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const userId = e.dataTransfer.getData("text/plain");
    if (userId) move(userId, zoneId);
  };
  const dropTarget = (zoneId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(zoneId);
    },
    onDragLeave: () => setOver((o) => (o === zoneId ? null : o)),
    onDrop: drop(zoneId),
  });

  const unavailable = new Set(data.unavailable);
  const pool = data.volunteers.filter((v) => !dutyOf.has(v.id));
  const zoneList = data.zones.map((z) => ({ id: z.id, name: z.name }));
  const volunteer = new Map(data.volunteers.map((v) => [v.id, v]));
  const filled = data.current.filter((d) => d.status !== "SWAPPED").length;
  const capacity = data.zones.reduce((s, z) => s + z.capacity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Choose a Saturday" className="flex flex-wrap gap-2">
          {data.saturdays.map((s) => (
            <Link
              key={s.id}
              href={`/admin/duties?meetingId=${s.id}`}
              scroll={false}
              aria-current={s.id === meeting.id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
                s.id === meeting.id ? "border-role bg-role-soft text-role-strong" : "border-border hover:bg-muted",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm" aria-live="polite">
            <span className="tabular font-semibold">
              {filled} of {capacity}
            </span>{" "}
            spots filled ·{" "}
            {data.publishedAt ? (
              <span className="text-(--status-ontime-fg)">Published</span>
            ) : (
              <span className="text-(--status-late-fg)">Not published yet</span>
            )}
          </p>
          <Button variant="role" disabled={busy || filled === 0} onClick={() => setPublishing(true)}>
            <Megaphone aria-hidden /> {data.publishedAt ? "Publish again" : "Publish to volunteers"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_1fr] [&>*]:min-w-0">
        <section
          aria-labelledby="pool-title"
          {...dropTarget(POOL)}
          className={cn(
            "space-y-3 rounded-(--radius-lg) border bg-card p-4 shadow-soft",
            over === POOL ? "border-role ring-2 ring-role/40" : "border-border",
          )}
        >
          <h2 id="pool-title" className="flex items-center justify-between text-base font-semibold">
            <span className="flex items-center gap-2">
              <Users aria-hidden className="size-4 text-role-strong" /> Volunteers
            </span>
            <span className="tabular rounded-full bg-muted px-2 text-sm">{pool.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Drag a name onto a zone, or use its menu. Drop here to take someone off.
          </p>
          {pool.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Everyone is placed.</p>
          ) : (
            <ul className="space-y-2">
              {pool.map((v) => (
                <PersonChip
                  key={v.id}
                  name={v.name}
                  userId={v.id}
                  detail={
                    unavailable.has(v.id)
                      ? "Can't make it (RSVP or excuse)"
                      : `${v.team ?? "No team"} · ${v.served} duties`
                  }
                  zones={zoneList}
                  currentZone={null}
                  disabled={busy}
                  onMove={move}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3 [&>*]:min-w-0">
          {data.zones.map((z) => {
            const here = data.current.filter((d) => d.zoneId === z.id && d.status !== "SWAPPED");
            const full = here.length >= z.capacity;
            return (
              <section
                key={z.id}
                aria-labelledby={`zone-${z.id}`}
                {...dropTarget(z.id)}
                className={cn(
                  "flex flex-col gap-3 rounded-(--radius-lg) border bg-card p-4 shadow-soft transition",
                  over === z.id
                    ? full
                      ? "border-(--danger) ring-2 ring-(--danger)/30"
                      : "border-role ring-2 ring-role/40"
                    : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 id={`zone-${z.id}`} className="font-heading text-lg font-semibold">
                      {z.name}
                    </h2>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 aria-hidden className="size-3.5" /> Arrive by {z.arrival}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "tabular rounded-full px-2 py-0.5 text-xs font-semibold",
                      full
                        ? "bg-(--status-ontime-bg) text-(--status-ontime-fg)"
                        : "bg-(--status-late-bg) text-(--status-late-fg)",
                    )}
                  >
                    {here.length}/{z.capacity} {full ? "full" : "open"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{z.tasks}</p>
                {here.length === 0 ? (
                  <p className="rounded-(--radius-md) border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                    Drop volunteers here
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {here.map((d) => (
                      <PersonChip
                        key={d.id}
                        name={d.name}
                        userId={d.userId}
                        detail={
                          d.status === "SWAP_REQUESTED"
                            ? "Asked to swap"
                            : d.status === "DONE"
                              ? "Done"
                              : (volunteer.get(d.userId)?.team ?? undefined)
                        }
                        zones={zoneList}
                        currentZone={z.id}
                        disabled={busy}
                        onMove={move}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <GlassCard className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles aria-hidden className="size-5 text-role-strong" /> Suggestions
          </h2>
          <p className="text-sm text-muted-foreground">
            Based on who served in each zone before, their team&apos;s zone, and sharing the load. Nothing changes until
            you add them.
          </p>
          {data.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions: every zone is full or nobody else is free.</p>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-(--radius-md) border border-border">
                {data.suggestions.map((s, i) => (
                  <li key={`${s.userId}-${s.zoneId}`}>
                    <label className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm">
                      <Checkbox
                        checked={picked.has(i)}
                        onCheckedChange={(v) =>
                          setPicked((p) => {
                            const n = new Set(p);
                            if (v === true) n.add(i);
                            else n.delete(i);
                            return n;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{s.name}</span> →{" "}
                        {data.zones.find((z) => z.id === s.zoneId)?.name}
                        <span className="block text-xs text-muted-foreground">{s.reason}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                disabled={busy || picked.size === 0}
                onClick={() =>
                  call(
                    {
                      action: "applySuggestions",
                      meetingId: meeting.id,
                      picks: data.suggestions
                        .filter((_, i) => picked.has(i))
                        .map((s) => ({ userId: s.userId, zoneId: s.zoneId })),
                    },
                    "Suggestions added",
                  )
                }
              >
                {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />} Add {picked.size}{" "}
                selected
              </Button>
            </>
          )}
        </GlassCard>

        <GlassCard className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Repeat aria-hidden className="size-5 text-role-strong" /> Swap requests
          </h2>
          {data.swaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No swap requests for the coming Saturdays.</p>
          ) : (
            <ul className="divide-y divide-border rounded-(--radius-md) border border-border">
              {data.swaps.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{s.person}</span> · {s.zone}, {s.meeting}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="role"
                      disabled={busy}
                      onClick={() => call({ action: "swap", dutyId: s.id, approve: true }, "Swap approved")}
                    >
                      <Check aria-hidden /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => call({ action: "swap", dutyId: s.id, approve: false }, "Swap declined")}
                    >
                      <X aria-hidden /> Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserMinus aria-hidden className="size-3.5" /> An approved swap frees the spot; place someone else in it.
          </p>
        </GlassCard>
      </div>

      <ConfirmDialog
        open={publishing}
        onOpenChange={setPublishing}
        title={`Publish the roster for ${meeting.label}?`}
        description={`Each of the ${filled} volunteers on the roster gets their zone and arrival time by email and in the app. Changes after publishing are sent to the people affected.`}
        confirmLabel="Publish"
        onConfirm={async () =>
          (await call({ action: "publish", meetingId: meeting.id }, "Roster published")) ? null : "Could not publish."
        }
      />
    </div>
  );
}
