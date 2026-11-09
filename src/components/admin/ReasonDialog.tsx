"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  label?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Return an error message to show, or null when done. */
  onConfirm: (reason: string) => Promise<string | null>;
}

/** Confirmation that needs a written reason (suspend, remove, decline): the reason goes to the audit log. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  confirmLabel,
  destructive,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const change = (o: boolean) => {
    if (o) {
      setReason("");
      setError(null);
    }
    onOpenChange(o);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) return setError("Give a short reason (at least 5 characters).");
    setBusy(true);
    const err = await onConfirm(reason.trim());
    setBusy(false);
    if (err) return setError(err);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField id="reason-text" label={label} error={error ?? undefined} hint="Kept in the audit log." required>
            {(aria) => (
              <Textarea {...aria} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            )}
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "role"} disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
