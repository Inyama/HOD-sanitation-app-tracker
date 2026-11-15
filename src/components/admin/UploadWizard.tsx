"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload as UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { NativeSelect } from "@/components/ui/form-field";
import { ErrorState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/api-client";
import { readFileAsBase64 } from "@/lib/upload-client";
import type { ColumnKey, ColumnMap } from "@/lib/matching/columns";
import type { Resolution } from "@/lib/matching/upload";
import { cn } from "@/lib/utils";
import { UploadMatchReview, type ReviewPerson, type ReviewRow } from "./UploadMatchReview";
import { ConfirmDialog } from "./ConfirmDialog";

export interface UploadMeetingOption {
  id: string;
  title: string;
  label: string;
  type: string;
  hasSheet: boolean;
}

interface PreviewData {
  upload: { id: string; status: string; originalName: string; rowsTotal: number };
  meeting: { id: string; title: string; startsAt: string };
  meetingLabel?: string;
  rows: ReviewRow[];
  people: ReviewPerson[];
  undecided: number;
  plan: { present: number; onTime: number; late: number; absent: number; excused: number; ignored: number };
  keptFromPhone: number;
  replaces: number;
}

const STEPS = ["Meeting", "File", "Columns", "Review", "Done"] as const;
type Step = 0 | 1 | 2 | 3 | 4;

const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone (optional)",
  time: "Check-in time (optional)",
  status: "Status (optional)",
};
const MAX_BYTES = 5 * 1024 * 1024;

/** Attendance upload wizard (spec 6.4, 7.4 item 6). */
export function UploadWizard({
  meetings,
  resumeId,
  onFinished,
}: {
  meetings: UploadMeetingOption[];
  resumeId: string | null;
  onFinished?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(resumeId ? 3 : 0);
  const [meetingId, setMeetingId] = React.useState(meetings[0]?.id ?? "");
  const [file, setFile] = React.useState<{ name: string; size: number; data: string } | null>(null);
  const [inspect, setInspect] = React.useState<{ headers: string[]; sample: string[][]; rows: number } | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMap>({});
  const [uploadId, setUploadId] = React.useState<string | null>(resumeId);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  const [result, setResult] = React.useState<PreviewData["plan"] | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const meeting = meetings.find((m) => m.id === meetingId);

  // The parent remounts the wizard (new key) to resume an upload; the query loads its preview.
  const previewQuery = useQuery({
    queryKey: ["upload-preview", uploadId],
    enabled: !!uploadId,
    queryFn: async () => {
      const r = await apiRequest<PreviewData>(`/api/v1/admin/uploads/${uploadId}/preview`);
      if (!r.ok) throw new Error(r.message);
      return r;
    },
  });
  const preview = previewQuery.data ?? null;
  const loadError = previewQuery.error ? (previewQuery.error as Error).message : null;

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const reset = () => {
    setStep(0);
    setFile(null);
    setInspect(null);
    setMapping({});
    setUploadId(null);
    setResult(null);
    setError(null);
    router.replace("/admin/uploads", { scroll: false });
  };

  const pick = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!/\.(csv|xlsx)$/i.test(f.name)) return setError("Choose a CSV or XLSX file.");
    if (f.size > MAX_BYTES) return setError("Files must be 5 MB or smaller.");
    setBusy(true);
    const data = await readFileAsBase64(f);
    const r = await apiRequest<{ headers: string[]; sample: string[][]; rows: number; columns: ColumnMap }>(
      "/api/v1/admin/uploads/inspect",
      { body: { name: f.name, size: f.size, data } },
    );
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setFile({ name: f.name, size: f.size, data });
    setInspect({ headers: r.headers, sample: r.sample, rows: r.rows });
    setMapping(r.columns);
    setStep(2);
  };

  const createPreview = async () => {
    if (!file) return;
    if (mapping.name === undefined || mapping.email === undefined)
      return setError("Choose the Name and Email columns.");
    setBusy(true);
    setError(null);
    const r = await apiRequest<{ uploadId: string }>("/api/v1/admin/uploads", {
      body: { meetingId, ...file, mapping },
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setUploadId(r.uploadId);
    setStep(3);
    router.refresh();
  };

  const resolve = async (row: ReviewRow, resolution: Resolution | null) => {
    if (!uploadId) return;
    const r = await apiRequest(`/api/v1/admin/uploads/${uploadId}/rows/${row.id}`, {
      method: "PATCH",
      body: { resolution },
    });
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    await previewQuery.refetch();
  };

  const confirm = async (replace: boolean): Promise<string | null> => {
    if (!uploadId) return null;
    setBusy(true);
    const r = await apiRequest<PreviewData["plan"]>(`/api/v1/admin/uploads/${uploadId}/confirm`, { body: { replace } });
    setBusy(false);
    if (!r.ok) {
      if (r.code === "NEEDS_REPLACE_CONFIRM") {
        setConfirmReplace(true);
        return null;
      }
      return r.message;
    }
    setResult(r);
    setStep(4);
    toast.success("Attendance saved from the sheet");
    router.refresh();
    onFinished?.();
    return null;
  };

  const discard = async () => {
    if (!uploadId) return reset();
    const r = await apiRequest(`/api/v1/admin/uploads/${uploadId}/rollback`, { body: {} });
    if (!r.ok) return toast.error(r.message);
    toast.success("Preview discarded");
    reset();
    router.refresh();
  };

  const readOnly = preview?.upload.status !== undefined && preview.upload.status !== "PREVIEW";

  return (
    <GlassCard className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Upload steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              i === step
                ? "border-role bg-role-soft text-role-strong"
                : i < step
                  ? "border-transparent bg-muted text-foreground"
                  : "border-border text-muted-foreground",
            )}
          >
            <span className="tabular">{i + 1}</span> {s}
            {i < step && <CircleCheck aria-label="done" className="size-3.5" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section aria-labelledby="step-title" className="space-y-4">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            Which meeting is this sheet for?
          </h2>
          {meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No held meetings in the last eight weeks.</p>
          ) : (
            <label className="block max-w-lg space-y-1.5 text-sm font-medium">
              Meeting
              <NativeSelect value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.hasSheet ? " (has a sheet)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {meeting?.hasSheet && (
            <p className="text-sm text-(--status-late-fg)">
              This meeting already has records from a sheet. Confirming a new one replaces them (you will be asked
              first).
            </p>
          )}
          <Button variant="role" disabled={!meetingId} onClick={() => setStep(1)}>
            Next <ArrowRight aria-hidden />
          </Button>
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="step-title" className="space-y-4">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            Add the attendee sheet
          </h2>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays aria-hidden className="size-4" /> {meeting?.label}
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex flex-col items-center gap-3 rounded-(--radius-lg) border-2 border-dashed px-6 py-10 text-center transition",
              dragging ? "border-role bg-role-soft" : "border-border",
            )}
          >
            <FileSpreadsheet aria-hidden className="size-10 text-role-strong" />
            <p className="text-sm">
              Drop a CSV or XLSX file here, or{" "}
              <button
                type="button"
                className="font-semibold text-role-strong underline underline-offset-4"
                onClick={() => inputRef.current?.click()}
              >
                choose a file
              </button>
              .
            </p>
            <p className="text-xs text-muted-foreground">
              Up to 5 MB and 5,000 rows. Name and email columns are required.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              aria-label="Choose an attendee sheet"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
            {busy && (
              <p className="inline-flex items-center gap-2 text-sm" role="status">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Reading the file…
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {error}
            </p>
          )}
          <Button variant="outline" onClick={() => setStep(0)}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        </section>
      )}

      {step === 2 && inspect && (
        <section aria-labelledby="step-title" className="space-y-4">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            Check the columns
          </h2>
          <p className="text-sm text-muted-foreground">
            {file?.name}: {inspect.rows} {inspect.rows === 1 ? "row" : "rows"}. We matched the headings we recognised;
            change any that are wrong.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((k) => (
              <label key={k} className="space-y-1.5 text-sm font-medium">
                {COLUMN_LABELS[k]}
                {(k === "name" || k === "email") && (
                  <span aria-hidden className="text-(--status-absent-fg)">
                    {" "}
                    *
                  </span>
                )}
                <NativeSelect
                  value={mapping[k] ?? ""}
                  aria-required={k === "name" || k === "email"}
                  onChange={(e) =>
                    setMapping((m) => {
                      const next = { ...m };
                      if (e.target.value === "") delete next[k];
                      else next[k] = Number(e.target.value);
                      return next;
                    })
                  }
                >
                  <option value="">{k === "name" || k === "email" ? "Choose a column…" : "Not in this file"}</option>
                  {inspect.headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-(--radius-md) border border-border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">First rows of the file</caption>
              <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
                <tr>
                  {inspect.headers.map((h, i) => (
                    <th key={i} scope="col" className="px-3 py-2 font-semibold">
                      {h || `Column ${i + 1}`}
                      {Object.entries(mapping).find(([, v]) => v === i) && (
                        <span className="ml-1 rounded bg-role-soft px-1 text-[0.625rem] text-role-strong normal-case">
                          {COLUMN_LABELS[Object.entries(mapping).find(([, v]) => v === i)![0] as ColumnKey].replace(
                            " (optional)",
                            "",
                          )}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inspect.sample.map((r, ri) => (
                  <tr key={ri}>
                    {inspect.headers.map((_, ci) => (
                      <td key={ci} className="px-3 py-1.5">
                        {r[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden /> Back
            </Button>
            <Button variant="role" disabled={busy} onClick={createPreview}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : <UploadIcon aria-hidden />} Match people
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="step-title" className="space-y-4">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            Review the matches
          </h2>
          {loadError ? (
            <ErrorState
              description={loadError}
              action={
                <Button variant="outline" onClick={() => previewQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : !preview ? (
            <div
              className="h-64 animate-pulse rounded-(--radius-md) bg-muted"
              aria-busy="true"
              aria-label="Loading the preview"
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {preview.upload.originalName} for {preview.meeting.title},{" "}
                {new Date(preview.meeting.startsAt).toLocaleString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Africa/Lagos",
                })}{" "}
                (Lagos) · {preview.rows.length} rows
              </p>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Present", preview.plan.present],
                  ["On time", preview.plan.onTime],
                  ["Late", preview.plan.late],
                  ["Absent", preview.plan.absent],
                  ["Excused", preview.plan.excused],
                  ["Rows skipped", preview.plan.ignored],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-(--radius-md) border border-border p-3">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="tabular font-heading text-2xl font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                What confirming will record. People expected but not on the sheet become Absent, or Excused with an
                approved excuse.
                {preview.keptFromPhone > 0 &&
                  ` ${preview.keptFromPhone} people already checked in by phone or manually keep that record.`}
              </p>
              <UploadMatchReview rows={preview.rows} people={preview.people} readOnly={readOnly} onResolve={resolve} />
              {!readOnly && (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm" aria-live="polite">
                    {preview.undecided > 0
                      ? `Decide ${preview.undecided} suggested ${preview.undecided === 1 ? "match" : "matches"} before confirming.`
                      : "Ready to confirm."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={discard}>
                      Discard preview
                    </Button>
                    <Button
                      variant="role"
                      disabled={busy || preview.undecided > 0}
                      onClick={async () => {
                        const err = await confirm(false);
                        if (err) toast.error(err);
                      }}
                    >
                      {busy ? <Loader2 aria-hidden className="animate-spin" /> : <CircleCheck aria-hidden />} Confirm
                      attendance
                    </Button>
                  </div>
                </div>
              )}
              {readOnly && (
                <Button variant="outline" onClick={reset}>
                  Start a new upload
                </Button>
              )}
            </>
          )}
        </section>
      )}

      {step === 4 && result && (
        <section aria-labelledby="step-title" className="space-y-4 text-center" role="status">
          <CircleCheck aria-hidden className="mx-auto size-12 text-(--success)" />
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
            Attendance saved
          </h2>
          <p className="text-sm text-muted-foreground">
            {result.present} present ({result.onTime} on time, {result.late} late), {result.absent} absent and{" "}
            {result.excused} excused.
            {result.ignored ? ` ${result.ignored} rows skipped.` : ""} You can roll this back from the history below.
          </p>
          <Button variant="role" onClick={reset}>
            <RotateCcw aria-hidden /> Upload another sheet
          </Button>
        </section>
      )}

      <ConfirmDialog
        open={confirmReplace}
        onOpenChange={setConfirmReplace}
        title="Replace the earlier sheet?"
        description={`This meeting already has ${preview?.replaces ?? 0} records from an earlier sheet. Confirming replaces them with this sheet, so nobody is counted twice. Phone and manual check-ins are kept.`}
        confirmLabel="Replace and confirm"
        onConfirm={() => confirm(true)}
      />
    </GlassCard>
  );
}
