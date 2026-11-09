"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleCheck, Clock3, Loader2, MapPin, Phone, Trash2, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { ReasonDialog } from "./ReasonDialog";

export interface PendingPerson {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "MEMBER" | "VOLUNTEER" | "ADMIN";
  city: string | null;
  country: string | null;
  language: string;
  isRemote: boolean;
  createdLabel: string;
  emailVerified: boolean;
  consentLocation: boolean;
  consentReminders: boolean;
  unitCode: string | null;
  zones: string[];
  availability: string[];
  notes: string | null;
}

export interface DeletionRequest {
  id: string;
  name: string;
  email: string;
  role: string;
  requestedLabel: string;
}

/** Pending approvals (spec 7.4 item 4) plus member deletion requests (spec 12). */
export function ApprovalsBoard({ pending, deletions }: { pending: PendingPerson[]; deletions: DeletionRequest[] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [declining, setDeclining] = React.useState<PendingPerson | null>(null);
  const [deleting, setDeleting] = React.useState<DeletionRequest | null>(null);

  const chosen = pending.filter((p) => selected.has(p.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const approve = async (p: PendingPerson) => {
    setBusy(p.id);
    const r = await apiRequest(`/api/v1/admin/members/${p.id}/approve`, { body: { approve: true } });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(`${p.name} approved`, { description: "We emailed them to say they can sign in." });
    router.refresh();
  };

  const approveSelected = async () => {
    setBusy("bulk");
    const r = await apiRequest<{ approved: string[]; skipped: { message: string }[] }>("/api/v1/admin/approvals", {
      body: { ids: chosen.map((c) => c.id) },
    });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(`${r.approved.length} approved`, {
      description: r.skipped.length ? `${r.skipped.length} skipped: ${r.skipped[0].message}` : undefined,
    });
    setSelected(new Set());
    router.refresh();
  };

  const decideDeletion = async (d: DeletionRequest, confirm: boolean) => {
    setBusy(d.id);
    const r = await apiRequest(`/api/v1/admin/members/${d.id}/deletion`, { body: { confirm } });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(confirm ? `${d.name}'s account is removed` : `${d.name}'s account is kept`, {
      description: confirm ? "Personal data is deleted after 30 days." : "They were told an admin will be in touch.",
    });
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="pending-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pending-title" className="text-xl font-semibold">
            Waiting for approval <span className="text-muted-foreground">({pending.length})</span>
          </h2>
          {pending.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelected(chosen.length === pending.length ? new Set() : new Set(pending.map((p) => p.id)))
                }
              >
                {chosen.length === pending.length ? "Clear selection" : "Select all"}
              </Button>
              <Button
                variant="role"
                size="sm"
                disabled={chosen.length === 0 || busy !== null}
                onClick={approveSelected}
              >
                {busy === "bulk" ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                Approve selected{chosen.length ? ` (${chosen.length})` : ""}
              </Button>
            </div>
          )}
        </div>

        {pending.length === 0 ? (
          <GlassCard>
            <EmptyState
              illustration="inbox"
              title="Nobody is waiting"
              description="New sign-ups appear here after they confirm their email."
            />
          </GlassCard>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            {pending.map((p) => (
              <li key={p.id}>
                <GlassCard className="flex h-full flex-col gap-4">
                  <div className="flex items-start gap-3">
                    {pending.length > 1 && (
                      <Checkbox
                        className="mt-3"
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                        aria-label={`Select ${p.name}`}
                      />
                    )}
                    <UserAvatar name={p.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        <Link href={`/admin/members/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Wants to join as a {p.role === "VOLUNTEER" ? "volunteer" : "member"} · signed up{" "}
                        {p.createdLabel}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="break-all">{p.email}</dd>
                      <dd>
                        {p.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-(--status-ontime-fg)">
                            <CircleCheck aria-hidden className="size-3.5" /> Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-(--status-late-fg)">
                            <Clock3 aria-hidden className="size-3.5" /> Not confirmed yet
                          </span>
                        )}
                      </dd>
                    </div>
                    {p.phone && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Phone</dt>
                        <dd className="flex items-center gap-1.5">
                          <Phone aria-hidden className="size-3.5" /> {p.phone}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-muted-foreground">Location</dt>
                      <dd className="flex items-center gap-1.5">
                        <MapPin aria-hidden className="size-3.5" />{" "}
                        {[p.city, p.country].filter(Boolean).join(", ") || "Not given"}
                        {p.isRemote && " · remote"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Consent</dt>
                      <dd>
                        Location at check-in: {p.consentLocation ? "yes" : "no"} · Reminders:{" "}
                        {p.consentReminders ? "yes" : "no"}
                      </dd>
                    </div>
                    {p.unitCode && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Unit code</dt>
                        <dd>{p.unitCode}</dd>
                      </div>
                    )}
                    {p.zones.length > 0 && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Would like to serve in</dt>
                        <dd>{p.zones.join(", ")}</dd>
                      </div>
                    )}
                    {p.availability.length > 0 && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Usually available</dt>
                        <dd>{p.availability.join(", ")}</dd>
                      </div>
                    )}
                    {p.notes && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">Their note</dt>
                        <dd>{p.notes}</dd>
                      </div>
                    )}
                  </dl>

                  {!p.emailVerified && (
                    <p className="rounded-(--radius-md) bg-(--status-late-bg) p-2.5 text-xs text-(--status-late-fg)">
                      You can approve now; they can sign in once they confirm their email.
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button variant="role" disabled={busy !== null} onClick={() => approve(p)}>
                      {busy === p.id ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />} Approve
                      <span className="sr-only"> {p.name}</span>
                    </Button>
                    <Button variant="outline" disabled={busy !== null} onClick={() => setDeclining(p)}>
                      <X aria-hidden /> Decline<span className="sr-only"> {p.name}</span>
                    </Button>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="deletion-title" className="space-y-4">
        <h2 id="deletion-title" className="text-xl font-semibold">
          Deletion requests <span className="text-muted-foreground">({deletions.length})</span>
        </h2>
        {deletions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has asked for their account to be deleted.</p>
        ) : (
          <ul className="space-y-3">
            {deletions.map((d) => (
              <li key={d.id}>
                <GlassCard padding="sm" className="flex flex-wrap items-center gap-3">
                  <UserX aria-hidden className="size-5 text-(--status-absent-fg)" />
                  <div className="min-w-0 flex-1 basis-48">
                    <Link href={`/admin/members/${d.id}`} className="font-semibold hover:underline">
                      {d.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {d.email} · asked {d.requestedLabel}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => decideDeletion(d, false)}>
                    Keep account<span className="sr-only"> for {d.name}</span>
                  </Button>
                  <Button variant="destructive" size="sm" disabled={busy !== null} onClick={() => setDeleting(d)}>
                    <Trash2 aria-hidden /> Delete<span className="sr-only"> {d.name}</span>
                  </Button>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReasonDialog
        open={!!declining}
        onOpenChange={(o) => !o && setDeclining(null)}
        title={`Decline ${declining?.name ?? ""}`}
        description="They get a polite email and cannot sign in. The reason stays in the audit log; it is not sent to them."
        confirmLabel="Decline"
        destructive
        onConfirm={async (reason) => {
          if (!declining) return null;
          const r = await apiRequest(`/api/v1/admin/members/${declining.id}/approve`, {
            body: { approve: false, reason },
          });
          if (!r.ok) return r.message;
          toast.success(`${declining.name} declined`);
          router.refresh();
          return null;
        }}
      />
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Delete {deleting?.name}&apos;s account?</DialogTitle>
            <DialogDescription>
              The account is removed now and can be restored for 30 days. After that their personal data is deleted for
              good. Attendance totals for the unit stay, without their name.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => deleting && decideDeletion(deleting, true)}
            >
              {busy && <Loader2 aria-hidden className="animate-spin" />} Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
