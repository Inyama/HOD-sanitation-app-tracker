"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Megaphone, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { RichText } from "@/components/ui/rich-text";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { ConfirmDialog } from "./ConfirmDialog";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author: string;
  createdLabel: string;
}

/** Announcements tab (spec 7.4 item 10): pinned updates for the volunteer Events feed and notification center. */
export function AnnouncementsPanel({ items }: { items: AnnouncementItem[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pinned, setPinned] = React.useState(false);
  const [notify, setNotify] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<AnnouncementItem | null>(null);
  const [deleting, setDeleting] = React.useState<AnnouncementItem | null>(null);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const r = await apiRequest<{ told: number }>("/api/v1/admin/announcements", {
      body: { title, body, pinned, notify },
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.error(r.message);
    }
    toast.success("Announcement posted", {
      description: r.told ? `${r.told} people were notified in the app.` : undefined,
    });
    setTitle("");
    setBody("");
    setPinned(false);
    router.refresh();
  };

  const patch = async (id: string, change: Record<string, unknown>, msg: string) => {
    const r = await apiRequest(`/api/v1/admin/announcements/${id}`, { method: "PATCH", body: change });
    if (!r.ok) return r.message;
    toast.success(msg);
    router.refresh();
    return null;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_1fr] [&>*]:min-w-0">
      <GlassCard className="self-start">
        <form onSubmit={post} noValidate className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Megaphone aria-hidden className="size-4 text-role-strong" /> Post an update
          </h2>
          <FormField id="ann-title" label="Title" required error={errors.title}>
            {(aria) => <Input {...aria} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
          </FormField>
          <FormField
            id="ann-body"
            label="Update"
            required
            error={errors.body}
            hint="Shown at the top of the volunteer Events feed. **Bold** and bullets work."
          >
            {(aria) => (
              <Textarea {...aria} rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
            )}
          </FormField>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} /> Pin to the top
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} /> Also notify everyone in the app
          </label>
          <Button type="submit" variant="role" disabled={busy}>
            {busy && <Loader2 aria-hidden className="animate-spin" />} Post announcement
          </Button>
        </form>
      </GlassCard>

      <section aria-labelledby="ann-list" className="space-y-3">
        <h2 id="ann-list" className="text-lg font-semibold">
          Announcements <span className="text-muted-foreground">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <GlassCard>
            <EmptyState
              illustration="inbox"
              title="No announcements"
              description="Updates you post appear in the Events feed."
            />
          </GlassCard>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id}>
                <GlassCard className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        {a.pinned && <Pin aria-label="Pinned" className="size-4 text-gold-600" />} {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.author}, {a.createdLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={a.pinned ? `Unpin ${a.title}` : `Pin ${a.title}`}
                        onClick={() => patch(a.id, { pinned: !a.pinned }, a.pinned ? "Unpinned" : "Pinned")}
                      >
                        {a.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${a.title}`}
                        onClick={() => setEditing(a)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${a.title}`}
                        onClick={() => setDeleting(a)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <RichText text={a.body} className="text-sm" />
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EditDialog key={editing?.id ?? "none"} item={editing} onClose={() => setEditing(null)} onSave={patch} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this announcement?"
        description={`“${deleting?.title ?? ""}” is removed from the Events feed and notification center.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const r = await apiRequest(`/api/v1/admin/announcements/${deleting!.id}`, { method: "DELETE" });
          if (!r.ok) return r.message;
          toast.success("Announcement deleted");
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}

function EditDialog({
  item,
  onClose,
  onSave,
}: {
  item: AnnouncementItem | null;
  onClose: () => void;
  onSave: (id: string, change: Record<string, unknown>, msg: string) => Promise<string | null>;
}) {
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [body, setBody] = React.useState(item?.body ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Edit announcement</DialogTitle>
          <DialogDescription>Changes show straight away in the Events feed.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!item) return;
            setBusy(true);
            const err = await onSave(item.id, { title, body }, "Announcement updated");
            setBusy(false);
            if (err) return setError(err);
            onClose();
          }}
        >
          <FormField id="ae-title" label="Title" required>
            {(aria) => <Input {...aria} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
          </FormField>
          <FormField id="ae-body" label="Update" required>
            {(aria) => (
              <Textarea {...aria} rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
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
              {busy && <Loader2 aria-hidden className="animate-spin" />} Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
