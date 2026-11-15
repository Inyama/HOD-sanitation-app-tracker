"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Eye, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusChip } from "@/components/attendance/StatusChip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { ReasonDialog } from "./ReasonDialog";

export interface ExcuseItem {
  id: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  reason: string;
  proofUrl: string | null;
  proofKind: "image" | "pdf" | null;
  createdLabel: string;
  reviewNote: string | null;
  reviewer: string | null;
  person: { id: string; name: string; email: string };
  meeting: { id: string; title: string; label: string; held: boolean };
  recordStatus: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED" | null;
  excusesThisYear: number;
}

function Proof({ item, onOpen }: { item: ExcuseItem; onOpen: () => void }) {
  if (!item.proofUrl) return <p className="text-xs text-muted-foreground">No proof attached.</p>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-11 items-center gap-3 rounded-(--radius-md) border border-border p-2 text-left text-sm hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-(--sky-400)"
      aria-label={`Preview proof from ${item.person.name}`}
    >
      {item.proofKind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- private file served by the API
        <img src={item.proofUrl} alt="" className="size-12 rounded object-cover" />
      ) : (
        <span className="flex size-12 items-center justify-center rounded bg-muted">
          <FileText aria-hidden className="size-6 text-role-strong" />
        </span>
      )}
      <span className="flex items-center gap-1 font-medium">
        <Eye aria-hidden className="size-4" /> Preview proof
      </span>
    </button>
  );
}

/** Excuse requests (spec 6.6, 7.4 item 13): queue with proof preview, approve or decline with a note. */
export function ExcuseQueue({ pending, decided }: { pending: ExcuseItem[]; decided: ExcuseItem[] }) {
  const router = useRouter();
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [declining, setDeclining] = React.useState<ExcuseItem | null>(null);
  const [previewing, setPreviewing] = React.useState<ExcuseItem | null>(null);

  const approve = async (e: ExcuseItem) => {
    setBusy(e.id);
    const r = await apiRequest<{ recordStatus: string | null }>(`/api/v1/admin/excuses/${e.id}`, {
      method: "PATCH",
      body: { decision: "APPROVED", note: notes[e.id]?.trim() || undefined },
    });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(`Excuse approved for ${e.person.name}`, {
      description: e.meeting.held
        ? "The meeting no longer counts against their attendance."
        : "It is applied when the meeting closes.",
    });
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="pending-ex" className="space-y-3">
        <h2 id="pending-ex" className="text-lg font-semibold">
          Waiting for a decision <span className="text-muted-foreground">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <GlassCard>
            <EmptyState
              illustration="inbox"
              title="All caught up"
              description="New excuse requests from members appear here."
            />
          </GlassCard>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            {pending.map((e) => (
              <li key={e.id}>
                <GlassCard className="flex h-full flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={e.person.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/members/${e.person.id}`} className="font-semibold hover:underline">
                        {e.person.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {e.meeting.title}, {e.meeting.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sent {e.createdLabel} · {e.excusesThisYear} approved this year
                      </p>
                    </div>
                    {e.recordStatus ? (
                      <StatusChip status={e.recordStatus} size="sm" />
                    ) : (
                      <StatusChip status="PENDING" size="sm" label={e.meeting.held ? "No record" : "Upcoming"} />
                    )}
                  </div>
                  <blockquote className="rounded-(--radius-md) bg-muted/50 p-3 text-sm leading-relaxed">
                    {e.reason}
                  </blockquote>
                  <Proof item={e} onOpen={() => setPreviewing(e)} />
                  <label className="space-y-1.5 text-sm font-medium">
                    Note to {e.person.name.split(" ")[0]} (optional when approving)
                    <Textarea
                      rows={2}
                      maxLength={300}
                      value={notes[e.id] ?? ""}
                      onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
                    />
                  </label>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button variant="role" disabled={busy !== null} onClick={() => approve(e)}>
                      {busy === e.id ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />} Approve
                    </Button>
                    <Button variant="outline" disabled={busy !== null} onClick={() => setDeclining(e)}>
                      <X aria-hidden /> Decline
                    </Button>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="decided-ex" className="space-y-3">
        <h2 id="decided-ex" className="text-lg font-semibold">
          Decided in the last 90 days
        </h2>
        {decided.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-card">
            {decided.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{e.person.name}</span> · {e.meeting.title}, {e.meeting.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.reviewer ? `${e.reviewer}: ` : ""}
                    {e.reviewNote ?? "No note"}
                  </p>
                </div>
                <StatusChip
                  status={e.status === "APPROVED" ? "EXCUSED" : "ABSENT"}
                  size="sm"
                  label={e.status === "APPROVED" ? "Approved" : "Declined"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReasonDialog
        open={!!declining}
        onOpenChange={(o) => !o && setDeclining(null)}
        title={`Decline ${declining?.person.name ?? ""}'s excuse?`}
        description="The record stays as it is. Your note is sent to them, so keep it kind and clear."
        label="Note to the member"
        confirmLabel="Decline"
        destructive
        onConfirm={async (note) => {
          const r = await apiRequest(`/api/v1/admin/excuses/${declining!.id}`, {
            method: "PATCH",
            body: { decision: "DECLINED", note },
          });
          if (!r.ok) return r.message;
          toast.success("Excuse declined");
          router.refresh();
          return null;
        }}
      />

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Proof from {previewing?.person.name}</DialogTitle>
            <DialogDescription>
              {previewing?.meeting.title}, {previewing?.meeting.label}.{" "}
              {previewing?.proofUrl && (
                <a
                  href={previewing.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-4"
                >
                  Open in a new tab
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          {previewing?.proofUrl &&
            (previewing.proofKind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- private file served by the API
              <img
                src={previewing.proofUrl}
                alt={`Proof uploaded by ${previewing.person.name}`}
                className="max-h-[70vh] w-full rounded-(--radius-md) object-contain"
              />
            ) : (
              <iframe
                src={previewing.proofUrl}
                title={`Proof uploaded by ${previewing.person.name}`}
                className="h-[70vh] w-full rounded-(--radius-md) border border-border"
              />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
