"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Heart, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusChip } from "@/components/attendance/StatusChip";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface TeamMemberRow {
  id: string;
  name: string;
  isLead: boolean;
  isMe: boolean;
  percent: number | null;
  band: { key: string; label: string };
  last: { dateLabel: string; status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED" }[];
}

export interface TeamBlock {
  id: string;
  name: string;
  members: TeamMemberRow[];
  swapRequests: { dutyId: string; name: string; label: string }[];
}

const BAND: Record<string, string> = {
  gold: "bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-300",
  green: "bg-(--status-ontime-bg) text-(--status-ontime-fg)",
  amber: "bg-(--status-late-bg) text-(--status-late-fg)",
  red: "bg-(--status-absent-bg) text-(--status-absent-fg)",
  none: "bg-muted text-muted-foreground",
};

/** Team view (spec 7.3): members with percentage and last five meetings, encouragement, swap approvals. */
export function TeamView({ teams }: { teams: TeamBlock[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<Set<string>>(new Set());

  const encourage = async (m: TeamMemberRow) => {
    setBusy(m.id);
    const r = await apiRequest("/api/v1/team/encourage", { body: { userId: m.id } });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    setSent((s) => new Set(s).add(m.id));
    toast.success(`Encouragement sent to ${m.name.split(" ")[0]}`);
  };
  const decide = async (dutyId: string, approve: boolean) => {
    setBusy(dutyId);
    const r = await apiRequest(`/api/v1/duties/${dutyId}/swap/decision`, { body: { approve } });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(approve ? "Swap approved: the spot is open again" : "Swap declined: they stay on the zone");
    router.refresh();
  };

  if (teams.length === 0)
    return <EmptyState illustration="search" title="No team to show" description="Team views are for Team Leads." />;
  return (
    <div className="space-y-6">
      {teams.map((t) => (
        <section key={t.id} aria-labelledby={`team-${t.id}`} className="space-y-4">
          <h2 id={`team-${t.id}`} className="text-xl font-semibold">
            {t.name} team{" "}
            <span className="text-base font-normal text-muted-foreground">· {t.members.length} people</span>
          </h2>
          {t.swapRequests.length > 0 && (
            <GlassCard tone="accent">
              <GlassCardHeader
                title={
                  <span className="flex items-center gap-2">
                    <ArrowLeftRight aria-hidden className="size-5 text-role-strong" /> Swap requests
                  </span>
                }
              />
              <ul className="space-y-2">
                {t.swapRequests.map((s) => (
                  <li key={s.dutyId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold">{s.name}</span> asks to be released from {s.label}
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" variant="role" disabled={busy !== null} onClick={() => decide(s.dutyId, true)}>
                        {busy === s.dutyId ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}{" "}
                        Approve<span className="sr-only"> swap for {s.name}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => decide(s.dutyId, false)}
                      >
                        <X aria-hidden /> Decline<span className="sr-only"> swap for {s.name}</span>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label={`${t.name} team members`}>
            {t.members.map((m) => (
              <li key={m.id} className="min-w-0">
                <GlassCard padding="sm" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <UserAvatar name={m.name} size={40} />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate font-semibold">
                        {m.name}
                        {m.isLead && <span className="ml-2 text-xs font-medium text-role-strong">Team Lead</span>}
                      </p>
                      <p className="flex items-center gap-2 text-sm">
                        <span className="tabular font-semibold">{m.percent === null ? "–" : `${m.percent}%`}</span>
                        <span
                          className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", BAND[m.band.key])}
                        >
                          {m.band.label}
                        </span>
                      </p>
                    </div>
                    {!m.isMe && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null || sent.has(m.id)}
                        onClick={() => encourage(m)}
                      >
                        {busy === m.id ? <Loader2 aria-hidden className="animate-spin" /> : <Heart aria-hidden />}
                        {sent.has(m.id) ? "Sent" : "Send encouragement"}
                        <span className="sr-only"> to {m.name}</span>
                      </Button>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Last five meetings</p>
                    {m.last.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No meetings yet.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5" aria-label={`${m.name}: last five meetings`}>
                        {m.last.map((x, i) => (
                          <li key={i}>
                            <StatusChip status={x.status} size="sm" label={`${x.dateLabel}`} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
