"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/attendance/StatusChip";
import { apiRequest } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

export interface ExcuseItem {
  id: string;
  meetingLabel: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  reviewNote: string | null;
  createdLabel: string;
  proofUrl: string | null;
}

export interface EligibleMeeting {
  id: string;
  label: string;
}

const STATUS_STYLE: Record<ExcuseItem["status"], string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-(--status-ontime-bg) text-(--status-ontime-fg)",
  DECLINED: "bg-(--status-absent-bg) text-(--status-absent-fg)",
};

/** Excuse requests (spec 6.6, 7.2): list with status and admin note, and a New request drawer. */
export function ExcuseRequests({ items, eligible }: { items: ExcuseItem[]; eligible: EligibleMeeting[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [meetingId, setMeetingId] = React.useState(eligible[0]?.id ?? "");
  const [reason, setReason] = React.useState("");
  const [proof, setProof] = React.useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setReason("");
    setProof(null);
    setErrors({});
    setMeetingId(eligible[0]?.id ?? "");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const r = await uploadFile(file, "excuse-proof");
    setUploading(false);
    if (!r.ok) setErrors((x) => ({ ...x, proof: r.message }));
    else {
      setErrors((x) => ({ ...x, proof: "" }));
      setProof({ url: r.url, name: r.name });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!meetingId) errs.meeting = "Choose the meeting.";
    if (reason.trim().length < 10) errs.reason = "Tell us a little more (at least 10 characters).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await apiRequest("/api/v1/me/excuses", {
      body: { meetingId, reason: reason.trim(), proofUrl: proof?.url ?? null },
    });
    setBusy(false);
    if (!r.ok) {
      setErrors({ form: r.message, ...(r.fields ?? {}) });
      return;
    }
    toast.success("Excuse request sent", { description: "A unit admin will review it." });
    setOpen(false);
    reset();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          You can ask from 7 days before a meeting to 7 days after it. Approved excuses do not count against your
          percentage.
        </p>
        <Button variant="role" onClick={() => setOpen(true)} disabled={eligible.length === 0}>
          <Plus aria-hidden /> New request
        </Button>
      </div>
      {eligible.length === 0 && (
        <p className="text-sm text-muted-foreground">There is no meeting you can request an excuse for right now.</p>
      )}

      {items.length === 0 ? (
        <EmptyState
          illustration="inbox"
          title="No excuse requests"
          description="If you cannot make a meeting, let us know here."
        />
      ) : (
        <ul className="space-y-3" aria-label="My excuse requests">
          {items.map((x) => (
            <li key={x.id}>
              <GlassCard padding="sm" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{x.meetingLabel}</p>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[x.status])}>
                    {x.status === "PENDING" ? "Pending review" : x.status === "APPROVED" ? "Approved" : "Declined"}
                  </span>
                </div>
                <p className="text-sm">{x.reason}</p>
                {x.proofUrl && (
                  <a
                    href={x.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-role-strong underline"
                  >
                    <FileText aria-hidden className="size-4" /> View proof
                  </a>
                )}
                {x.reviewNote && (
                  <p className="rounded-(--radius-sm) bg-muted p-2.5 text-sm">
                    <span className="font-semibold">Admin note:</span> {x.reviewNote}
                  </p>
                )}
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  Sent {x.createdLabel}
                  {x.status === "APPROVED" && <StatusChip status="EXCUSED" size="sm" />}
                </p>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onOpenChange={(o) => (setOpen(o), o ? undefined : reset())}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">New excuse request</SheetTitle>
            <SheetDescription>Tell us which meeting and why. A unit admin will approve or decline it.</SheetDescription>
          </SheetHeader>
          <form onSubmit={submit} noValidate className="space-y-4 px-4 pb-6">
            {errors.form && (
              <p role="alert" className="text-sm text-(--status-absent-fg)">
                {errors.form}
              </p>
            )}
            <FormField id="ex-meeting" label="Meeting" error={errors.meeting || errors.meetingId} required>
              {(aria) => (
                <NativeSelect {...aria} value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
                  {eligible.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField
              id="ex-reason"
              label="Reason"
              error={errors.reason}
              hint="For example: travelling for a family event, unwell, work shift."
              required
            >
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={5}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                />
              )}
            </FormField>
            <div className="space-y-1.5">
              <p className="text-sm font-medium" id="ex-proof-label">
                Proof (optional)
              </p>
              {proof ? (
                <p className="flex items-center gap-2 rounded-(--radius-sm) border border-border p-2 text-sm">
                  <Paperclip aria-hidden className="size-4" />
                  <span className="min-w-0 flex-1 truncate">{proof.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${proof.name}`}
                    onClick={() => setProof(null)}
                  >
                    <X aria-hidden />
                  </Button>
                </p>
              ) : (
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-sm) border border-dashed border-border px-3 py-2 text-sm hover:border-role">
                  {uploading ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Paperclip aria-hidden className="size-4" />
                  )}
                  {uploading ? "Uploading…" : "Attach an image or PDF (2 MB max)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="sr-only"
                    aria-labelledby="ex-proof-label"
                    aria-describedby={errors.proof ? "ex-proof-error" : undefined}
                    onChange={onFile}
                  />
                </label>
              )}
              {errors.proof && (
                <p id="ex-proof-error" className="text-sm text-(--status-absent-fg)">
                  {errors.proof}
                </p>
              )}
            </div>
            <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy || uploading}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} Send request
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
