"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Yes or no confirmation for actions that change data (rollback, replace, publish). Escape closes it. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Return an error message to keep the dialog open, or null when done. */
  onConfirm: () => Promise<string | null>;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    const err = await onConfirm();
    setBusy(false);
    if (err) return setError(err);
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setError(null);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        {error && (
          <p role="alert" className="text-sm text-(--status-absent-fg)">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "role"} disabled={busy} onClick={go}>
            {busy && <Loader2 aria-hidden className="animate-spin" />} {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
