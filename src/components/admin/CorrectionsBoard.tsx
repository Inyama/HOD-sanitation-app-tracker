"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, Flag, Hand, History, Loader2, MessageSquareWarning, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusChip } from "@/components/attendance/StatusChip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { ReasonDialog } from "./ReasonDialog";

type Status = "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED";
const WORD: Record<Status, string> = { ON_TIME: "On time", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused" };
const METHOD: Record<string, string> = { GEO: "Phone", SHEET: "Sheet", MANUAL: "Manual" };

export interface RecordItem {
  id: string;
  person: { id: string; name: string };
  meeting: { id: string; title: string; label: string };
  status: Status;
  timeLabel: string | null;
  method: string;
  flagged: boolean;
  flagReason: string | null;
  distanceM: number | null;
  accuracyM: number | null;
  deviceId: string | null;
  recordedBy: string | null;
  note: string | null;
}

export interface DisputeItem {
  id: string;
  status: "OPEN" | "RESOLVED";
  claimed: Status;
  message: string;
  createdLabel: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  person: { id: string; name: string };
  meeting: { id: string; title: string; label: string };
  record: { status: Status; timeLabel: string | null; method: string } | null;
}

export interface HistoryItem {
  id: string;
  atLabel: string;
  by: string;
  person: string | null;
  meeting: string | null;
  before: { status: Status; timeLabel: string | null } | null;
  after: { status: Status; timeLabel: string | null };
  reason: string | null;
}

interface Target {
  kind: "record" | "dispute";
  id: string;
  title: string;
  current: { status: Status; timeLabel: string | null } | null;
  suggested?: Status;
}

function ChangeDialog({
  target,
  onClose,
  onDone,
}: {
  target: Target | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [status, setStatus] = React.useState<Status>(target?.suggested ?? target?.current?.status ?? "ON_TIME");
  const [arrivedAt, setArrivedAt] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const attended = status === "ON_TIME" || status === "LATE";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (reason.trim().length < 5) return setErrors({ reason: "Give a short reason (at least 5 characters)." });
    setBusy(true);
    setErrors({});
    setError(null);
    const body = { status, arrivedAt: attended && arrivedAt ? arrivedAt : null };
    const r =
      target.kind === "record"
        ? await apiRequest(`/api/v1/admin/attendance/${target.id}`, { method: "PATCH", body: { ...body, reason } })
        : await apiRequest(`/api/v1/admin/disputes/${target.id}`, {
            method: "PATCH",
            body: { ...body, accept: true, note: reason },
          });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setError(r.message);
    }
    onClose();
    onDone(target.kind === "record" ? "Record changed" : "Query accepted and the record changed");
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {target?.kind === "dispute" ? "Accept the query" : "Change the record"}
          </DialogTitle>
          <DialogDescription>
            {target?.title}. The person is told, and the audit log keeps before and after with your reason.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div
            className="flex flex-wrap items-center gap-2 rounded-(--radius-md) bg-muted/50 p-3 text-sm"
            aria-live="polite"
          >
            <span className="text-muted-foreground">Before</span>
            {target?.current ? (
              <StatusChip
                status={target.current.status}
                size="sm"
                label={`${WORD[target.current.status]}${target.current.timeLabel ? ` · ${target.current.timeLabel}` : ""}`}
              />
            ) : (
              <StatusChip status="PENDING" size="sm" label="No record" />
            )}
            <ArrowRight aria-label="becomes" className="size-4" />
            <span className="text-muted-foreground">After</span>
            <StatusChip
              status={status}
              size="sm"
              label={`${WORD[status]}${attended && arrivedAt ? ` · ${arrivedAt}` : ""}`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="c-status" label="New status" required error={errors.status}>
              {(aria) => (
                <NativeSelect {...aria} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  {(Object.keys(WORD) as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {WORD[s]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            {attended && (
              <FormField
                id="c-time"
                label="Arrival time (Lagos, optional)"
                error={errors.arrivedAt}
                hint="Must fit the status."
              >
                {(aria) => (
                  <Input {...aria} type="time" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)} />
                )}
              </FormField>
            )}
          </div>
          <FormField
            id="c-reason"
            label="Reason"
            required
            error={errors.reason ?? errors.note}
            hint="Sent to the person and kept in the audit log."
          >
            {(aria) => (
              <Textarea {...aria} rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="role" disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} Save change
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordCard({ r, onChange, onReview }: { r: RecordItem; onChange: () => void; onReview?: () => void }) {
  return (
    <GlassCard className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/members/${r.person.id}`} className="font-semibold hover:underline">
            {r.person.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {r.meeting.title}, {r.meeting.label}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusChip
            status={r.status}
            size="sm"
            label={`${WORD[r.status]}${r.timeLabel ? ` · ${r.timeLabel}` : ""}`}
          />
          {r.flagged && <StatusChip status="FLAGGED" size="sm" />}
          {r.method === "MANUAL" && <StatusChip status="MANUAL" size="sm" />}
        </div>
      </div>
      {r.flagReason && (
        <p className="flex items-start gap-2 rounded-(--radius-md) bg-(--status-absent-bg) p-2.5 text-sm text-(--status-absent-fg)">
          <Flag aria-hidden className="mt-0.5 size-4 shrink-0" /> {r.flagReason}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Method</dt>
          <dd>{METHOD[r.method] ?? r.method}</dd>
        </div>
        {r.distanceM !== null && (
          <div>
            <dt className="text-muted-foreground">Distance</dt>
            <dd className="tabular">{r.distanceM} m</dd>
          </div>
        )}
        {r.accuracyM !== null && (
          <div>
            <dt className="text-muted-foreground">GPS accuracy</dt>
            <dd className="tabular">{r.accuracyM} m</dd>
          </div>
        )}
        {r.recordedBy && (
          <div>
            <dt className="text-muted-foreground">Recorded by</dt>
            <dd>{r.recordedBy}</dd>
          </div>
        )}
        {r.deviceId && (
          <div className="col-span-2">
            <dt className="text-muted-foreground">Device</dt>
            <dd className="truncate font-mono">{r.deviceId}</dd>
          </div>
        )}
      </dl>
      {r.note && <p className="text-xs text-muted-foreground">Note: {r.note}</p>}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="role" onClick={onChange}>
          <Pencil aria-hidden /> Change record
        </Button>
        {onReview && (
          <Button size="sm" variant="outline" onClick={onReview}>
            <Check aria-hidden /> Looks fine, clear flag
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

/** Corrections and disputes (spec 7.4 item 15). */
export function CorrectionsBoard({
  flagged,
  manual,
  disputes,
  history,
}: {
  flagged: RecordItem[];
  manual: RecordItem[];
  disputes: DisputeItem[];
  history: HistoryItem[];
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<Target | null>(null);
  const [targetKey, setTargetKey] = React.useState(0);
  const [reviewing, setReviewing] = React.useState<RecordItem | null>(null);
  const [declining, setDeclining] = React.useState<DisputeItem | null>(null);
  const open = disputes.filter((d) => d.status === "OPEN");
  const done = (msg: string) => {
    toast.success(msg);
    router.refresh();
  };
  const change = (t: Target) => {
    setTargetKey((k) => k + 1);
    setTarget(t);
  };
  const recordTarget = (r: RecordItem): Target => ({
    kind: "record",
    id: r.id,
    title: `${r.person.name}, ${r.meeting.title} ${r.meeting.label}`,
    current: { status: r.status, timeLabel: r.timeLabel },
  });

  const empty = (title: string, description: string) => (
    <GlassCard>
      <EmptyState illustration="broom" title={title} description={description} />
    </GlassCard>
  );

  return (
    <>
      <Tabs defaultValue={flagged.length ? "flagged" : open.length ? "disputes" : "manual"}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="flagged" className="min-h-10 gap-1.5">
            <Flag aria-hidden className="size-4" /> Flagged{" "}
            <span className="tabular rounded-full bg-muted px-1.5 text-xs">{flagged.length}</span>
          </TabsTrigger>
          <TabsTrigger value="disputes" className="min-h-10 gap-1.5">
            <MessageSquareWarning aria-hidden className="size-4" /> Disputes{" "}
            <span className="tabular rounded-full bg-muted px-1.5 text-xs">{open.length}</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="min-h-10 gap-1.5">
            <Hand aria-hidden className="size-4" /> Manual check-ins{" "}
            <span className="tabular rounded-full bg-muted px-1.5 text-xs">{manual.length}</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-10 gap-1.5">
            <History aria-hidden className="size-4" /> Changes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flagged" className="mt-4">
          {flagged.length === 0 ? (
            empty(
              "No flagged check-ins",
              "Suspicious check-ins (shared device, big jumps, poor accuracy, many attempts) wait here.",
            )
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              {flagged.map((r) => (
                <li key={r.id}>
                  <RecordCard r={r} onChange={() => change(recordTarget(r))} onReview={() => setReviewing(r)} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="disputes" className="mt-4">
          {disputes.length === 0 ? (
            empty("No disputes", "When a member says a record is wrong, it appears here.")
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              {disputes.map((d) => (
                <li key={d.id}>
                  <GlassCard className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/members/${d.person.id}`} className="font-semibold hover:underline">
                          {d.person.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {d.meeting.title}, {d.meeting.label}
                        </p>
                        <p className="text-xs text-muted-foreground">Sent {d.createdLabel}</p>
                      </div>
                      <span
                        className={
                          d.status === "OPEN"
                            ? "rounded-full bg-(--status-late-bg) px-2 py-0.5 text-xs font-semibold text-(--status-late-fg)"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold"
                        }
                      >
                        {d.status === "OPEN" ? "Open" : "Resolved"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Record</span>
                      {d.record ? (
                        <StatusChip
                          status={d.record.status}
                          size="sm"
                          label={`${WORD[d.record.status]}${d.record.timeLabel ? ` · ${d.record.timeLabel}` : ""}`}
                        />
                      ) : (
                        <StatusChip status="PENDING" size="sm" label="No record" />
                      )}
                      <span className="text-muted-foreground">They say</span>
                      <StatusChip status={d.claimed} size="sm" />
                    </div>
                    <blockquote className="rounded-(--radius-md) bg-muted/50 p-3 text-sm leading-relaxed">
                      {d.message}
                    </blockquote>
                    {d.status === "RESOLVED" ? (
                      <p className="text-xs text-muted-foreground">
                        {d.resolvedBy}: {d.resolutionNote}
                      </p>
                    ) : (
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="role"
                          onClick={() =>
                            change({
                              kind: "dispute",
                              id: d.id,
                              title: `${d.person.name}, ${d.meeting.title} ${d.meeting.label}`,
                              current: d.record ? { status: d.record.status, timeLabel: d.record.timeLabel } : null,
                              suggested: d.claimed,
                            })
                          }
                        >
                          <Check aria-hidden /> Accept and correct
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeclining(d)}>
                          <X aria-hidden /> Keep the record
                        </Button>
                      </div>
                    )}
                  </GlassCard>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          {manual.length === 0 ? (
            empty("No manual check-ins", "Check-ins recorded by marshals in the last 90 days appear here after review.")
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              {manual.map((r) => (
                <li key={r.id}>
                  <RecordCard r={r} onChange={() => change(recordTarget(r))} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {history.length === 0 ? (
            empty("No changes yet", "Every change to a record is listed here with before and after.")
          ) : (
            <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-card">
              {history.map((h) => (
                <li key={h.id} className="space-y-1.5 px-4 py-3">
                  <p className="text-sm">
                    <span className="font-semibold">{h.person ?? "Someone"}</span>
                    {h.meeting ? ` · ${h.meeting}` : ""}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    {h.before ? (
                      <StatusChip
                        status={h.before.status}
                        size="sm"
                        label={`${WORD[h.before.status]}${h.before.timeLabel ? ` · ${h.before.timeLabel}` : ""}`}
                      />
                    ) : (
                      <StatusChip status="PENDING" size="sm" label="No record" />
                    )}
                    <ArrowRight aria-label="became" className="size-4" />
                    <StatusChip
                      status={h.after.status}
                      size="sm"
                      label={`${WORD[h.after.status]}${h.after.timeLabel ? ` · ${h.after.timeLabel}` : ""}`}
                    />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.by}, {h.atLabel}
                    {h.reason ? ` · “${h.reason}”` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ChangeDialog key={targetKey} target={target} onClose={() => setTarget(null)} onDone={done} />
      <ReasonDialog
        open={!!reviewing}
        onOpenChange={(o) => !o && setReviewing(null)}
        title="Clear this flag?"
        description={`${reviewing?.person.name ?? ""}'s check-in stays ${reviewing ? WORD[reviewing.status] : ""}. Say briefly why it looks fine.`}
        label="Note"
        confirmLabel="Clear flag"
        onConfirm={async (note) => {
          const r = await apiRequest(`/api/v1/admin/attendance/${reviewing!.id}/review`, { body: { note } });
          if (!r.ok) return r.message;
          done("Flag cleared");
          return null;
        }}
      />
      <ReasonDialog
        open={!!declining}
        onOpenChange={(o) => !o && setDeclining(null)}
        title="Keep the record as it is?"
        description={`${declining?.person.name ?? ""} is told the record stays the same, with your note.`}
        label="Note to the member"
        confirmLabel="Keep record"
        onConfirm={async (note) => {
          const r = await apiRequest(`/api/v1/admin/disputes/${declining!.id}`, {
            method: "PATCH",
            body: { accept: false, note },
          });
          if (!r.ok) return r.message;
          done("Query answered");
          return null;
        }}
      />
    </>
  );
}
