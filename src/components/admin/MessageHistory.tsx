"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, BarChart3, CircleCheck, CircleX, Clock3, Eye, Mail, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";

export interface HistoryMessage {
  id: string;
  subject: string;
  sender: string;
  audience: string;
  channels: string[];
  status: "SENT" | "SCHEDULED" | "CANCELLED";
  whenLabel: string;
  recipients: number;
  read: number;
  emailsSent: number;
  emailsFailed: number;
  attachments: number;
}

interface Report {
  message: { subject: string };
  rows: {
    userId: string;
    name: string;
    deliveredAt: string | null;
    readAt: string | null;
    email: { status: string; error: string | null } | null;
  }[];
}

const STATUS = {
  SENT: { label: "Sent", cls: "bg-(--status-ontime-bg) text-(--status-ontime-fg)", icon: CircleCheck },
  SCHEDULED: { label: "Scheduled", cls: "bg-(--status-excused-bg) text-(--status-excused-fg)", icon: Clock3 },
  CANCELLED: { label: "Cancelled", cls: "bg-muted text-muted-foreground", icon: Ban },
};

/** Sent and scheduled messages with delivery and read figures (spec 7.4 item 10). */
export function MessageHistory({ items }: { items: HistoryMessage[] }) {
  const router = useRouter();
  const [report, setReport] = React.useState<{ id: string; subject: string } | null>(null);
  const [data, setData] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState<HistoryMessage | null>(null);

  const openReport = async (m: HistoryMessage) => {
    setReport({ id: m.id, subject: m.subject });
    setData(null);
    setError(null);
    const r = await apiRequest<Report>(`/api/v1/admin/messages/${m.id}/delivery`);
    if (!r.ok) return setError(r.message);
    setData(r);
  };

  if (items.length === 0)
    return (
      <GlassCard>
        <EmptyState
          illustration="inbox"
          title="No messages yet"
          description="Messages you send or schedule appear here with delivery and read figures."
        />
      </GlassCard>
    );

  return (
    <>
      <ul className="space-y-3">
        {items.map((m) => {
          const s = STATUS[m.status];
          const readPct = m.recipients ? Math.round((m.read / m.recipients) * 100) : 0;
          return (
            <li key={m.id}>
              <GlassCard className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{m.subject}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        s.cls,
                      )}
                    >
                      <s.icon aria-hidden className="size-3" /> {s.label}
                    </span>
                    {m.attachments > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Paperclip aria-hidden className="size-3" /> {m.attachments}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {m.audience} · {m.channels.map((c) => (c === "IN_APP" ? "In-app" : "Email")).join(" and ")} ·{" "}
                    {m.sender}, {m.whenLabel}
                  </p>
                </div>
                {m.status === "SENT" && (
                  <dl className="grid grid-cols-3 gap-4 text-sm md:w-80">
                    <div>
                      <dt className="text-xs text-muted-foreground">Delivered</dt>
                      <dd className="tabular font-semibold">{m.recipients}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Read</dt>
                      <dd className="tabular font-semibold">
                        {m.read} <span className="font-normal text-muted-foreground">({readPct}%)</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Emails</dt>
                      <dd className="tabular font-semibold">
                        {m.emailsSent}
                        {m.emailsFailed > 0 && (
                          <span className="text-(--status-absent-fg)"> · {m.emailsFailed} failed</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                )}
                <div className="flex gap-2">
                  {m.status === "SENT" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReport(m)}
                      aria-label={`Delivery report for ${m.subject}`}
                    >
                      <BarChart3 aria-hidden /> Report
                    </Button>
                  )}
                  {m.status === "SCHEDULED" && (
                    <Button size="sm" variant="outline" onClick={() => setCancelling(m)}>
                      <Ban aria-hidden /> Cancel
                    </Button>
                  )}
                </div>
              </GlassCard>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Delivery report</DialogTitle>
            <DialogDescription>{report?.subject}</DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {error}
            </p>
          ) : !data ? (
            <LoadingState rows={4} label="Loading the report" />
          ) : (
            <div
              className="max-h-[60vh] overflow-auto rounded-(--radius-md) border border-border"
              tabIndex={0}
              role="region"
              aria-label="Recipients"
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Person
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      In-app
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Read
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.map((r) => (
                    <tr key={r.userId}>
                      <th scope="row" className="px-3 py-1.5 text-left font-medium">
                        {r.name}
                      </th>
                      <td className="px-3 py-1.5">{r.deliveredAt ? "Delivered" : "Not delivered"}</td>
                      <td className="px-3 py-1.5">
                        {r.readAt ? (
                          <span className="inline-flex items-center gap-1 text-(--status-ontime-fg)">
                            <Eye aria-hidden className="size-3.5" /> Read
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unread</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {!r.email ? (
                          <span className="text-muted-foreground">Not sent</span>
                        ) : r.email.status === "SENT" ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail aria-hidden className="size-3.5" /> Sent
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-(--status-absent-fg)"
                            title={r.email.error ?? undefined}
                          >
                            <CircleX aria-hidden className="size-3.5" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this scheduled message?"
        description={`“${cancelling?.subject ?? ""}” will not be sent. You can write it again later.`}
        confirmLabel="Cancel message"
        destructive
        onConfirm={async () => {
          const r = await apiRequest(`/api/v1/admin/messages/${cancelling!.id}/cancel`, { body: {} });
          if (!r.ok) return r.message;
          toast.success("Scheduled message cancelled");
          router.refresh();
          return null;
        }}
      />
    </>
  );
}
