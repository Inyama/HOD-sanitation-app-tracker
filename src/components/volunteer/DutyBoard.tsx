"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Loader2, LogOut, Package, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import type { BoardZone } from "@/lib/volunteer/duties";
import { cn } from "@/lib/utils";

export interface BoardMeeting {
  id: string;
  label: string;
  startsAt: string;
  /** Can I still withdraw myself (more than 12 hours before)? */
  canWithdraw: boolean;
  board: BoardZone[];
}

/** Duty board (spec 7.3): open tasks by zone for the next Saturdays; sign up, withdraw, request a swap. */
export function DutyBoard({ meetings, names }: { meetings: BoardMeeting[]; names: Record<string, string> }) {
  const router = useRouter();
  const [tab, setTab] = React.useState(meetings[0]?.id ?? "");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<{ kind: "withdraw" | "swap"; dutyId: string; zone: string } | null>(
    null,
  );
  const current = meetings.find((m) => m.id === tab) ?? meetings[0];
  if (!current) return null;
  const myZone = current.board.find((z) => z.mine);

  const run = async (key: string, url: string, init: { method?: string; body?: unknown }, success: string) => {
    setBusy(key);
    const r = await apiRequest(url, init);
    setBusy(null);
    if (!r.ok) toast.error(r.message);
    else {
      toast.success(success);
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {meetings.length > 1 && (
        <div
          role="tablist"
          aria-label="Saturday"
          className="inline-flex rounded-full border border-border bg-surface p-0.5"
        >
          {meetings.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === current.id}
              onClick={() => setTab(m.id)}
              className={cn(
                "h-10 cursor-pointer rounded-full px-4 text-sm font-medium pointer-coarse:h-11",
                m.id === current.id ? "bg-role-btn text-role-btn-fg" : "text-muted-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {myZone ? (
          <>
            You are on <span className="font-semibold text-foreground">{myZone.name}</span> for {current.label}
            {myZone.mine?.status === "SWAP_REQUESTED" && " (swap requested: waiting for your Team Lead)"}.
          </>
        ) : (
          <>You have no duty for {current.label} yet. Choose a zone with open spots.</>
        )}
      </p>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={`Zones for ${current.label}`}>
        {current.board.map((z) => {
          const full = z.open === 0;
          const mine = z.mine;
          return (
            <li key={z.zoneId}>
              <GlassCard className={cn("flex h-full flex-col gap-3", mine && "ring-2 ring-role")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">{z.name}</h3>
                    <p className="text-sm text-muted-foreground">{z.tasks}</p>
                  </div>
                  {mine && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-role-soft px-2.5 py-0.5 text-xs font-semibold text-role-strong">
                      <Check aria-hidden className="size-3.5" /> Yours
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {full ? "Full" : `${z.open} open spot${z.open === 1 ? "" : "s"}`}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {z.taken} of {z.capacity}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${z.name}: ${z.taken} of ${z.capacity} spots taken`}
                    aria-valuemin={0}
                    aria-valuemax={z.capacity}
                    aria-valuenow={z.taken}
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist"
                  >
                    <div
                      className={cn("h-full rounded-full", full ? "bg-(--status-late)" : "bg-role")}
                      style={{ width: `${(z.taken / z.capacity) * 100}%` }}
                    />
                  </div>
                </div>
                {z.assignees.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label={`Volunteers on ${z.name}`}>
                    {z.assignees.map((a) => (
                      <li
                        key={a.dutyId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs"
                      >
                        <UserAvatar name={names[a.userId] ?? "?"} size={22} />
                        {names[a.userId]?.split(" ")[0] ?? "Volunteer"}
                        {a.status === "SWAP_REQUESTED" && <span className="text-(--status-late-fg)">(swap)</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Package aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {z.supplies.join(", ")}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {mine ? (
                    mine.status === "SWAP_REQUESTED" ? (
                      <span className="text-sm font-medium text-(--status-late-fg)">Swap requested</span>
                    ) : current.canWithdraw ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setConfirm({ kind: "withdraw", dutyId: mine.dutyId, zone: z.name })}
                      >
                        <LogOut aria-hidden /> Withdraw
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setConfirm({ kind: "swap", dutyId: mine.dutyId, zone: z.name })}
                      >
                        <ArrowLeftRight aria-hidden /> Request swap
                      </Button>
                    )
                  ) : (
                    <Button
                      variant="role"
                      size="sm"
                      disabled={full || !!myZone || busy !== null}
                      onClick={() =>
                        run(
                          z.zoneId,
                          "/api/v1/duties",
                          { body: { meetingId: current.id, zoneId: z.zoneId } },
                          `You are on ${z.name}`,
                        )
                      }
                    >
                      {busy === z.zoneId ? <Loader2 aria-hidden className="animate-spin" /> : <UserPlus aria-hidden />}{" "}
                      Sign up<span className="sr-only"> for {z.name}</span>
                    </Button>
                  )}
                </div>
              </GlassCard>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {confirm?.kind === "withdraw" ? `Withdraw from ${confirm.zone}?` : `Request a swap for ${confirm?.zone}?`}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "withdraw"
                ? "Your spot opens for someone else. You can sign up again while spots are free."
                : "It is less than 12 hours to the meeting, so your Team Lead decides. You stay on the zone until they approve."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep my duty</Button>
            </DialogClose>
            <Button
              variant={confirm?.kind === "withdraw" ? "destructive" : "role"}
              onClick={() => {
                const c = confirm!;
                setConfirm(null);
                if (c.kind === "withdraw")
                  run(c.dutyId, `/api/v1/duties/${c.dutyId}`, { method: "DELETE" }, `You withdrew from ${c.zone}`);
                else run(c.dutyId, `/api/v1/duties/${c.dutyId}/swap`, { body: {} }, "Swap requested");
              }}
            >
              {confirm?.kind === "withdraw" ? "Withdraw" : "Request swap"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
