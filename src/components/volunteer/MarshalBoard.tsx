"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Clock3, Flag, Hand, Loader2, QrCode, Search, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { ErrorState, LoadingState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusChip } from "@/components/attendance/StatusChip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { lagosClock } from "@/lib/member/display";
import type { LivePerson } from "@/lib/volunteer/marshal";
import { cn } from "@/lib/utils";

interface LiveData {
  meeting: { id: string; title: string; startsAt: string; requireQr: boolean };
  phase: "BEFORE" | "OPEN_ON_TIME" | "OPEN_LATE" | "CLOSED";
  present: LivePerson[];
  late: LivePerson[];
  expected: LivePerson[];
  excused: number;
}

const PHASE: Record<LiveData["phase"], string> = {
  BEFORE: "Check-in has not opened yet",
  OPEN_ON_TIME: "Check-in is open: arrivals are On time",
  OPEN_LATE: "Check-in is open: arrivals count as Late",
  CLOSED: "Check-in has closed",
};

function QrPanel({ meetingId }: { meetingId: string }) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const q = useQuery({
    queryKey: ["qr", meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/meetings/${meetingId}/qr`);
      if (!res.ok) throw new Error("QR unavailable");
      return (await res.json()) as { code: string; url: string; expiresInMs: number; requireQr: boolean };
    },
    refetchInterval: (query) => Math.max(1000, (query.state.data?.expiresInMs ?? 30_000) + 200),
  });
  React.useEffect(() => {
    if (!q.data) return;
    QRCode.toString(q.data.url, { type: "svg", margin: 1, color: { dark: "#0a1a44", light: "#ffffff" } }).then(setSvg);
  }, [q.data]);
  return (
    <GlassCard className="space-y-3 text-center">
      <h2 className="flex items-center justify-center gap-2 text-lg font-semibold">
        <QrCode aria-hidden className="size-5 text-role-strong" /> Rotating check-in code
      </h2>
      <p className="text-sm text-muted-foreground">
        {q.data?.requireQr
          ? "This meeting needs the code as a second proof."
          : "Optional second proof. An admin can require it for a meeting."}{" "}
        A new code every 30 seconds.
      </p>
      {q.isError ? (
        <ErrorState description="The code could not be loaded." />
      ) : !q.data ? (
        <div className="mx-auto size-48 animate-pulse rounded-(--radius-md) bg-muted" />
      ) : (
        <>
          <div className="mx-auto w-48 rounded-(--radius-md) border border-border bg-white p-2">
            {svg && (
              <div
                role="img"
                aria-label={`QR code for check-in code ${q.data.code}`}
                className="[&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
          <p className="tabular font-heading text-4xl font-semibold tracking-[0.25em]" aria-live="polite">
            {q.data.code}
          </p>
        </>
      )}
    </GlassCard>
  );
}

function PersonList({
  title,
  people,
  icon: Icon,
  empty,
  kind,
}: {
  title: string;
  people: LivePerson[];
  icon: typeof Users;
  empty: string;
  kind: "ON_TIME" | "LATE" | "EXPECTED";
}) {
  return (
    <section aria-label={title} className="rounded-(--radius-lg) border border-border bg-card shadow-soft">
      <h2 className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-base font-semibold">
        <span className="flex items-center gap-2">
          <Icon aria-hidden className="size-4 text-role-strong" /> {title}
        </span>
        <span className="tabular rounded-full bg-muted px-2 text-sm">{people.length}</span>
      </h2>
      {people.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul tabIndex={0} aria-label={`${title} list`} className="max-h-96 divide-y divide-border overflow-auto">
          {people.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 px-4 py-2">
              <UserAvatar name={p.name} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                {kind !== "EXPECTED" && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="tabular text-xs text-muted-foreground">{lagosClock(p.checkedInAt)}</span>
                    {p.method === "MANUAL" && <StatusChip status="MANUAL" size="sm" />}
                    {p.flagged && <StatusChip status="FLAGGED" size="sm" />}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Marshal tools (spec 7.3): live present, late and expected lists, manual check-in, rotating QR. */
export function MarshalBoard({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [person, setPerson] = React.useState("");
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const q = useQuery({
    queryKey: ["live", meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/meetings/${meetingId}/live`);
      if (!res.ok) throw new Error("The live lists could not be loaded.");
      return (await res.json()) as LiveData;
    },
    refetchInterval: 5000,
  });
  const d = q.data;
  const needle = search.trim().toLowerCase();
  const f = (xs: LivePerson[]) => xs.filter((p) => !needle || p.name.toLowerCase().includes(needle));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!person) errs.person = "Choose the person.";
    if (note.trim().length < 3) errs.note = "Add a short reason, for example: phone battery flat.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await apiRequest<{ record: { status: "ON_TIME" | "LATE" }; person: { name: string } }>(
      `/api/v1/meetings/${meetingId}/manual-check-in`,
      {
        body: { userId: person, note: note.trim() },
      },
    );
    setBusy(false);
    if (!r.ok) return setErrors({ form: r.message });
    toast.success(`${r.person.name} checked in: ${r.record.status === "ON_TIME" ? "On time" : "Late"}`, {
      description: "Shown as Manual and flagged for admin review.",
    });
    setOpen(false);
    setPerson("");
    setNote("");
    qc.invalidateQueries({ queryKey: ["live", meetingId] });
  };

  if (q.isLoading) return <LoadingState rows={5} label="Loading live lists" />;
  if (q.isError || !d)
    return (
      <ErrorState
        description={(q.error as Error)?.message}
        action={
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        }
      />
    );
  const open_ = d.phase === "OPEN_ON_TIME" || d.phase === "OPEN_LATE";

  return (
    <div className="space-y-5">
      <GlassCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{d.meeting.title}</p>
          <p
            className={cn(
              "flex items-center gap-1.5 text-sm",
              d.phase === "OPEN_LATE" ? "text-(--status-late-fg)" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            <Clock3 aria-hidden className="size-4" /> {PHASE[d.phase]} · updates every 5 seconds
          </p>
        </div>
        <dl className="flex gap-4 text-center">
          {[
            ["Present", d.present.length],
            ["Late", d.late.length],
            ["Not yet", d.expected.length],
            ["Excused", d.excused],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tabular font-heading text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <Button variant="role" onClick={() => setOpen(true)} disabled={!open_}>
          <Hand aria-hidden /> Manual check-in
        </Button>
      </GlassCard>

      <div className="relative max-w-sm">
        <label htmlFor="m-search" className="sr-only">
          Search people
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="m-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_18rem]">
        <PersonList title="Present" people={f(d.present)} icon={UserCheck} empty="Nobody yet." kind="ON_TIME" />
        <PersonList title="Late" people={f(d.late)} icon={Flag} empty="Nobody late." kind="LATE" />
        <PersonList
          title="Expected"
          people={f(d.expected)}
          icon={Users}
          empty="Everyone expected is here."
          kind="EXPECTED"
        />
        <div className="lg:col-span-3 xl:col-span-1">
          <QrPanel meetingId={meetingId} />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Manual check-in</DialogTitle>
            <DialogDescription>
              For someone at the venue whose phone cannot check in. It is recorded with your name, shown as Manual and
              flagged for an admin to review.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate className="space-y-4">
            {errors.form && (
              <p role="alert" className="text-sm text-(--status-absent-fg)">
                {errors.form}
              </p>
            )}
            <FormField id="mc-person" label="Person" error={errors.person} required>
              {(aria) => (
                <NativeSelect {...aria} value={person} onChange={(e) => setPerson(e.target.value)}>
                  <option value="">Choose from the expected list…</option>
                  {d.expected.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="mc-note" label="Reason" error={errors.note} required>
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="Phone battery flat"
                />
              )}
            </FormField>
            <Button type="submit" variant="role" className="w-full" disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} Record check-in
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
