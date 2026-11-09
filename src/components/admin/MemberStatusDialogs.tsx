"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { ReasonDialog } from "./ReasonDialog";

export type StatusAction = "suspend" | "reactivate" | "remove" | "restore";

export interface StatusTarget {
  id: string;
  name: string;
  action: StatusAction;
}

/** Suspend, reactivate, remove (soft delete) and restore, shared by the directory and the profile. */
export function MemberStatusDialogs({
  target,
  onClose,
  onDone,
}: {
  target: StatusTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const open = (a: StatusAction) => target?.action === a;
  const close = (o: boolean) => !o && onClose();

  const withReason = async (reason: string) => {
    if (!target) return null;
    const r =
      target.action === "remove"
        ? await apiRequest(`/api/v1/admin/members/${target.id}`, { method: "DELETE", body: { reason } })
        : await apiRequest(`/api/v1/admin/members/${target.id}/status`, { body: { action: "suspend", reason } });
    if (!r.ok) return r.message;
    toast.success(target.action === "remove" ? `${target.name} removed` : `${target.name} suspended`, {
      description: target.action === "remove" ? "You can restore them within 30 days." : undefined,
    });
    onDone();
    return null;
  };

  const simple = async () => {
    if (!target) return;
    setBusy(true);
    const r = await apiRequest<{ status: string }>(`/api/v1/admin/members/${target.id}/status`, {
      body: { action: target.action },
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    toast.success(
      target.action === "restore"
        ? `${target.name} restored${r.status === "PENDING" ? " to the approvals queue" : ""}`
        : `${target.name} is active again`,
    );
    onClose();
    onDone();
  };

  return (
    <>
      <ReasonDialog
        open={open("suspend")}
        onOpenChange={close}
        title={`Suspend ${target?.name ?? ""}`}
        description="They cannot sign in while suspended. Their history is kept, and you can reactivate them at any time."
        confirmLabel="Suspend"
        destructive
        onConfirm={withReason}
      />
      <ReasonDialog
        open={open("remove")}
        onOpenChange={close}
        title={`Remove ${target?.name ?? ""}`}
        description="This is a soft delete: the account is hidden and can be restored for 30 days. After that their personal data is deleted."
        confirmLabel="Remove"
        destructive
        onConfirm={withReason}
      />
      <Dialog open={open("reactivate") || open("restore")} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {target?.action === "restore" ? `Restore ${target?.name}` : `Reactivate ${target?.name}`}
            </DialogTitle>
            <DialogDescription>
              {target?.action === "restore"
                ? "Their account comes back with its history. If they were never approved, they return to the approvals queue."
                : "They can sign in and check in again straight away."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="role" onClick={simple} disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />}
              {target?.action === "restore" ? "Restore" : "Reactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
