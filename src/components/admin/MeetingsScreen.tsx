"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  List,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Sheet as SheetIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import type { MeetingRow, MeetingsScreen as Data } from "@/lib/admin/ops-meetings";
import { cn } from "@/lib/utils";
import { MeetingFormSheet, type EditableMeeting } from "./MeetingFormSheet";
import { ReasonDialog } from "./ReasonDialog";
import { ConfirmDialog } from "./ConfirmDialog";

const TYPE_DOT: Record<string, string> = {
  SATURDAY: "bg-royal-600",
  THURSDAY_PRAYER: "bg-teal-600",
  SPECIAL: "bg-gold-500",
};
const TYPE_WORD: Record<string, string> = {
  SATURDAY: "Saturday",
  THURSDAY_PRAYER: "Thursday prayer",
  SPECIAL: "Special event",
};
const METHOD_WORD: Record<string, string> = {
  GEO: "Location check-in",
  SHEET: "Attendee sheet",
  BOTH: "Location and sheet",
};

function StatusTag({ m }: { m: Pick<MeetingRow, "status" | "statusNote" | "held"> }) {
  if (m.status === "CANCELLED")
    return (
      <span className="rounded-full bg-(--status-absent-bg) px-2 py-0.5 text-xs font-semibold text-(--status-absent-fg)">
        Cancelled
      </span>
    );
  if (m.statusNote?.startsWith("Rescheduled"))
    return (
      <span className="rounded-full bg-(--status-late-bg) px-2 py-0.5 text-xs font-semibold text-(--status-late-fg)">
        Rescheduled
      </span>
    );
  if (m.status === "CLOSED")
    return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Closed</span>;
  if (m.held) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Held</span>;
  return (
    <span className="rounded-full bg-(--status-excused-bg) px-2 py-0.5 text-xs font-semibold text-(--status-excused-fg)">
      Scheduled
    </span>
  );
}

function RescheduleDialog({
  meeting,
  today,
  onOpenChange,
  onDone,
}: {
  meeting: MeetingRow | null;
  today: string;
  onOpenChange: (o: boolean) => void;
  onDone: (msg: string) => void;
}) {
  const [date, setDate] = React.useState(meeting?.date ?? today);
  const [time, setTime] = React.useState(meeting?.time ?? "09:30");
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;
    setBusy(true);
    setErrors({});
    setError(null);
    const r = await apiRequest<{ told: number }>(`/api/v1/admin/meetings/${meeting.id}`, {
      method: "PATCH",
      body: { action: "reschedule", date, time, reason },
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setError(r.message);
    }
    onOpenChange(false);
    onDone(`Moved. ${r.told} people were told by email and in the app.`);
  };
  return (
    <Dialog open={!!meeting} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Reschedule {meeting?.title}</DialogTitle>
          <DialogDescription>
            Currently {meeting?.label} (Lagos). Everyone expected is told, and reminders move to the new time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField id="rs-date" label="New date" required error={errors.date}>
              {(aria) => (
                <Input {...aria} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              )}
            </FormField>
            <FormField id="rs-time" label="New time" required error={errors.time}>
              {(aria) => <Input {...aria} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
            </FormField>
          </div>
          <FormField
            id="rs-reason"
            label="Reason (included in the notice)"
            required
            error={errors.reason}
            hint="For example: The hall is booked for a wedding."
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="role" disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} Move and notify
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Meetings and events (spec 7.4 item 7): month calendar and list; create, edit, cancel, reschedule. */
export function MeetingsScreen({ data }: { data: Data }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetKey, setSheetKey] = React.useState(0);
  const [editing, setEditing] = React.useState<EditableMeeting | null>(null);
  const [moving, setMoving] = React.useState<MeetingRow | null>(null);
  const [cancelling, setCancelling] = React.useState<MeetingRow | null>(null);
  const [closing, setClosing] = React.useState<MeetingRow | null>(null);

  const done = (msg: string) => {
    toast.success(msg);
    router.refresh();
  };
  const openNew = () => {
    setEditing(null);
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  };
  const openEdit = (m: MeetingRow) => {
    setEditing({ ...m });
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  };

  const row = (m: MeetingRow) => (
    <li key={m.id}>
      <GlassCard className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", TYPE_DOT[m.type])} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{m.title}</p>
            <p className="text-sm text-muted-foreground">
              {m.label} · {TYPE_WORD[m.type]}
            </p>
          </div>
          <StatusTag m={m} />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1">
            {m.method === "SHEET" ? (
              <SheetIcon aria-hidden className="size-3.5" />
            ) : (
              <MapPin aria-hidden className="size-3.5" />
            )}
            {METHOD_WORD[m.method]}
          </li>
          {m.method !== "SHEET" && (
            <li>
              Window {m.openBeforeMin} min before to {m.closeAfterMin} min after · grace {m.graceMinutes} min
              {m.radiusM ? ` · ${m.radiusM} m radius` : ""}
            </li>
          )}
          {m.recurring && (
            <li className="inline-flex items-center gap-1">
              <Repeat aria-hidden className="size-3.5" /> Weekly
            </li>
          )}
          {m.held ? <li>{m.present} present</li> : m.going > 0 && <li>{m.going} going</li>}
        </ul>
        {m.statusNote && <p className="text-xs">{m.statusNote}</p>}
        {(!m.held && m.status !== "CANCELLED") || m.closable ? (
          <div className="mt-auto flex flex-wrap gap-2">
            {!m.held && m.status !== "CANCELLED" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(m)}
                  aria-label={`Edit ${m.title}, ${m.label}`}
                >
                  <Pencil aria-hidden /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMoving(m)}
                  aria-label={`Reschedule ${m.title}, ${m.label}`}
                >
                  <CalendarClock aria-hidden /> Reschedule
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCancelling(m)}
                  aria-label={`Cancel ${m.title}, ${m.label}`}
                >
                  <Ban aria-hidden /> Cancel
                </Button>
              </>
            )}
            {m.closable && (
              <Button size="sm" variant="role" onClick={() => setClosing(m)}>
                <ClipboardCheck aria-hidden /> Close and record absentees
              </Button>
            )}
          </div>
        ) : null}
      </GlassCard>
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(TYPE_WORD).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2.5 rounded-full", TYPE_DOT[k])} /> {v}
            </span>
          ))}
        </p>
        <Button variant="role" onClick={openNew}>
          <Plus aria-hidden /> New meeting
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="min-h-10 gap-1.5">
            <List aria-hidden className="size-4" /> List
          </TabsTrigger>
          <TabsTrigger value="calendar" className="min-h-10 gap-1.5">
            <CalendarDays aria-hidden className="size-4" /> Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-8">
          <section aria-labelledby="upcoming-title" className="space-y-3">
            <h2 id="upcoming-title" className="text-lg font-semibold">
              Coming up (next six weeks)
            </h2>
            {data.upcoming.length === 0 ? (
              <GlassCard>
                <EmptyState
                  illustration="calendar"
                  title="Nothing scheduled"
                  description="Create a meeting or special event."
                  action={
                    <Button variant="role" onClick={openNew}>
                      New meeting
                    </Button>
                  }
                />
              </GlassCard>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">{data.upcoming.map(row)}</ul>
            )}
          </section>
          <section aria-labelledby="recent-title" className="space-y-3">
            <h2 id="recent-title" className="text-lg font-semibold">
              Recent (last six weeks)
            </h2>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent meetings.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">{data.recent.map(row)}</ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/admin/meetings?month=${data.prevMonth}`}
                scroll={false}
                className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                aria-label="Previous month"
              >
                <ChevronLeft aria-hidden />
              </Link>
              <h2 className="font-heading text-xl font-semibold" aria-live="polite">
                {data.monthLabel}
              </h2>
              <Link
                href={`/admin/meetings?month=${data.nextMonth}`}
                scroll={false}
                className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                aria-label="Next month"
              >
                <ChevronRight aria-hidden />
              </Link>
            </div>
            <div
              role="grid"
              aria-label={`Meetings in ${data.monthLabel}`}
              className="grid grid-cols-7 gap-px overflow-hidden rounded-(--radius-md) border border-border bg-border text-sm"
            >
              <div role="row" className="contents">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div
                    key={d}
                    role="columnheader"
                    className="bg-muted/60 py-2 text-center text-xs font-semibold text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {data.weeks.map((w, wi) => (
                <div role="row" key={wi} className="contents">
                  {w.map((d) => (
                    <div
                      role="gridcell"
                      key={d.date}
                      aria-label={`${d.date}${d.meetings.length ? `: ${d.meetings.map((m) => `${m.title} ${m.time}${m.status === "CANCELLED" ? " cancelled" : ""}`).join(", ")}` : ""}`}
                      className={cn(
                        "min-h-20 bg-card p-1.5 sm:min-h-24",
                        !d.inMonth && "bg-muted/30 text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "tabular inline-flex size-6 items-center justify-center rounded-full text-xs",
                          d.isToday && "bg-role-btn font-semibold text-role-btn-fg",
                        )}
                      >
                        {Number(d.date.slice(8))}
                      </span>
                      <ul className="mt-1 space-y-1">
                        {d.meetings.map((m) => (
                          <li
                            key={m.id}
                            className={cn(
                              "flex items-center gap-1 truncate text-[0.6875rem] leading-tight",
                              m.status === "CANCELLED" && "line-through opacity-70",
                            )}
                          >
                            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TYPE_DOT[m.type])} />
                            <span className="truncate">
                              <span className="hidden sm:inline">{m.time} </span>
                              {m.title.replace(" Meeting", "")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Struck-through meetings are cancelled. Lagos dates and times.
            </p>
          </GlassCard>
        </TabsContent>
      </Tabs>

      <MeetingFormSheet
        key={sheetKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        defaults={data.defaults}
        venueRadius={data.venue?.radiusM ?? 100}
        today={data.today}
        onSaved={done}
      />
      <RescheduleDialog
        key={moving?.id ?? "none"}
        meeting={moving}
        today={data.today}
        onOpenChange={(o) => !o && setMoving(null)}
        onDone={done}
      />
      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={`Cancel ${cancelling?.title ?? "meeting"}?`}
        description={`${cancelling?.label ?? ""} (Lagos). Everyone expected is told by email and in the app, and its reminders stop. A cancelled meeting never counts towards attendance.`}
        label="Reason (included in the notice)"
        confirmLabel="Cancel meeting and notify"
        destructive
        onConfirm={async (reason) => {
          const r = await apiRequest<{ told: number }>(`/api/v1/admin/meetings/${cancelling!.id}`, {
            method: "PATCH",
            body: { action: "cancel", reason },
          });
          if (!r.ok) return r.message;
          done(`Cancelled. ${r.told} people were told.`);
          return null;
        }}
      />
      <ConfirmDialog
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        title="Close and record absentees?"
        description={`Check-in for ${closing?.title ?? "this meeting"} (${closing?.label ?? ""}) has ended. Everyone expected without a record becomes Absent, or Excused if their excuse was approved.`}
        confirmLabel="Close meeting"
        onConfirm={async () => {
          const r = await apiRequest<{ absent: number; excused: number }>(
            `/api/v1/admin/meetings/${closing!.id}/close`,
            { body: {} },
          );
          if (!r.ok) return r.message;
          done(`Closed: ${r.absent} absent, ${r.excused} excused.`);
          return null;
        }}
      />
    </div>
  );
}
