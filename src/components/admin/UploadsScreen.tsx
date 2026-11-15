"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileDown, History, PlayCircle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { UploadWizard, type UploadMeetingOption } from "./UploadWizard";
import { ConfirmDialog } from "./ConfirmDialog";

export interface HistoryItem {
  id: string;
  originalName: string;
  meetingTitle: string;
  meetingLabel: string;
  uploader: string;
  uploadedLabel: string;
  status: "PREVIEW" | "CONFIRMED" | "ROLLED_BACK";
  rowsTotal: number;
  rowsMatched: number;
  rowsException: number;
  rolledBackLabel: string | null;
}

const STATUS = {
  PREVIEW: { label: "Preview", cls: "bg-(--status-late-bg) text-(--status-late-fg)" },
  CONFIRMED: { label: "Confirmed", cls: "bg-(--status-ontime-bg) text-(--status-ontime-fg)" },
  ROLLED_BACK: { label: "Rolled back", cls: "bg-muted text-muted-foreground" },
};

const SAMPLES = [
  { name: "attendance-template.csv", label: "Blank template (CSV)" },
  { name: "thursday-with-errors.csv", label: "Sample with 3 errors (CSV)" },
  { name: "thursday-with-errors.xlsx", label: "Sample with 3 errors (XLSX)" },
  { name: "thursday-clean.csv", label: "Clean sample (CSV)" },
];

export function UploadsScreen({
  meetings,
  history,
  initialResume,
}: {
  meetings: UploadMeetingOption[];
  history: HistoryItem[];
  initialResume: string | null;
}) {
  const router = useRouter();
  const [resume, setResume] = React.useState<string | null>(initialResume);
  const [rollingBack, setRollingBack] = React.useState<HistoryItem | null>(null);
  const top = React.useRef<HTMLDivElement>(null);

  const rollback = async (): Promise<string | null> => {
    if (!rollingBack) return null;
    const r = await apiRequest<{ removed: number }>(`/api/v1/admin/uploads/${rollingBack.id}/rollback`, { body: {} });
    if (!r.ok) return r.message;
    toast.success("Upload rolled back", { description: `${r.removed} records from this sheet were removed.` });
    router.refresh();
    return null;
  };

  return (
    <div className="space-y-8" ref={top}>
      <UploadWizard key={resume ?? "new"} meetings={meetings} resumeId={resume} />

      <section aria-labelledby="samples-title" className="space-y-3">
        <h2 id="samples-title" className="flex items-center gap-2 text-lg font-semibold">
          <FileDown aria-hidden className="size-5 text-role-strong" /> Template and samples
        </h2>
        <ul className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <li key={s.name}>
              <a
                href={`/api/v1/admin/uploads/samples/${s.name}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                download
              >
                <Download aria-hidden /> {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="flex items-center gap-2 text-lg font-semibold">
          <History aria-hidden className="size-5 text-role-strong" /> Upload history
        </h2>
        {history.length === 0 ? (
          <GlassCard>
            <EmptyState
              illustration="inbox"
              title="No uploads yet"
              description="Sheets you upload appear here with a one-click rollback."
            />
          </GlassCard>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            {history.map((h) => (
              <li key={h.id}>
                <GlassCard className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{h.originalName}</p>
                      <p className="text-sm text-muted-foreground">
                        {h.meetingTitle}, {h.meetingLabel}
                      </p>
                    </div>
                    <span
                      className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[h.status].cls)}
                    >
                      {STATUS[h.status].label}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="tabular">{h.rowsTotal}</span> rows ·{" "}
                    <span className="tabular">{h.rowsMatched}</span> matched by email ·{" "}
                    <span className="tabular">{h.rowsException}</span> exceptions
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.uploader}, {h.uploadedLabel}
                    {h.rolledBackLabel ? ` · rolled back ${h.rolledBackLabel}` : ""}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {h.status === "PREVIEW" && (
                      <Button
                        size="sm"
                        variant="role"
                        onClick={() => {
                          setResume(h.id);
                          top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        <PlayCircle aria-hidden /> Continue review
                      </Button>
                    )}
                    {h.status === "CONFIRMED" && (
                      <Button size="sm" variant="outline" onClick={() => setRollingBack(h)}>
                        <RotateCcw aria-hidden /> Roll back
                      </Button>
                    )}
                    <a
                      href={`/api/v1/admin/uploads/${h.id}/file`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      aria-label={`Download the original file ${h.originalName}`}
                    >
                      <Download aria-hidden /> Original file
                    </a>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!rollingBack}
        onOpenChange={(o) => !o && setRollingBack(null)}
        title="Roll back this upload?"
        description={`The attendance records written from ${rollingBack?.originalName ?? "this sheet"} are removed, so the meeting goes back to how it was before. You can upload the sheet again afterwards.`}
        confirmLabel="Roll back"
        destructive
        onConfirm={rollback}
      />
    </div>
  );
}
