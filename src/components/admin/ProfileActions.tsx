"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore, Award, Ban, Loader2, MessageSquare, Pencil, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { apiRequest } from "@/lib/api-client";
import type { UserStatus } from "@/lib/repo/types";
import { MemberFormSheet, type MemberFormValues } from "./MemberFormSheet";
import { MemberStatusDialogs, type StatusTarget } from "./MemberStatusDialogs";
import { MessageDialog } from "./MessageDialog";

interface ProfileActionsProps {
  person: MemberFormValues & { id: string; status: UserStatus; canRestore: boolean };
  teams: { id: string; name: string }[];
  canManage: boolean;
  canMessage: boolean;
  canAssignRoles: boolean;
}

/** Profile header actions: edit, message, suspend or reactivate, remove or restore, change role. */
export function ProfileActions({ person, teams, canManage, canMessage, canAssignRoles }: ProfileActionsProps) {
  const router = useRouter();
  const [editKey, setEditKey] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<StatusTarget | null>(null);
  const [messaging, setMessaging] = React.useState(false);
  const refresh = () => router.refresh();
  const t = (action: StatusTarget["action"]) => setStatus({ id: person.id, name: person.name, action });

  return (
    <div className="flex flex-wrap gap-2">
      {canManage && person.status !== "REMOVED" && (
        <Button variant="outline" onClick={() => setEditKey(Date.now())}>
          <Pencil aria-hidden /> Edit
        </Button>
      )}
      {canMessage && person.status === "ACTIVE" && (
        <Button variant="outline" onClick={() => setMessaging(true)}>
          <MessageSquare aria-hidden /> Message
        </Button>
      )}
      {canAssignRoles && (person.status === "ACTIVE" || person.status === "SUSPENDED") && (
        <Button asChild variant="outline">
          <Link href={`/admin/roles?person=${person.id}`}>
            <Award aria-hidden /> Role and titles
          </Link>
        </Button>
      )}
      {canManage && person.status === "PENDING" && (
        <Button asChild variant="role">
          <Link href="/admin/approvals">
            <UserCheck aria-hidden /> Review sign-up
          </Link>
        </Button>
      )}
      {canManage && person.status === "ACTIVE" && (
        <Button variant="destructive" onClick={() => t("suspend")}>
          <Ban aria-hidden /> Suspend
        </Button>
      )}
      {canManage && person.status === "SUSPENDED" && (
        <Button variant="role" onClick={() => t("reactivate")}>
          <UserCheck aria-hidden /> Reactivate
        </Button>
      )}
      {canManage && person.status !== "REMOVED" && (
        <Button variant="destructive" onClick={() => t("remove")}>
          <Trash2 aria-hidden /> Remove
        </Button>
      )}
      {canManage && person.status === "REMOVED" && person.canRestore && (
        <Button variant="role" onClick={() => t("restore")}>
          <ArchiveRestore aria-hidden /> Restore
        </Button>
      )}

      {editKey !== null && (
        <MemberFormSheet
          key={editKey}
          open
          onOpenChange={(o) => !o && setEditKey(null)}
          teams={teams}
          initial={person}
          onSaved={refresh}
        />
      )}
      <MemberStatusDialogs target={status} onClose={() => setStatus(null)} onDone={refresh} />
      <MessageDialog
        people={[{ id: person.id, name: person.name }]}
        open={messaging}
        onOpenChange={setMessaging}
        defaultSubject=""
        defaultBody="Hello {first_name}, "
      />
    </div>
  );
}

/** Admin-only notes on a profile (never shown to the person). */
export function NotesForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 3) return setError("Write a note (at least 3 characters).");
    setBusy(true);
    const r = await apiRequest(`/api/v1/admin/members/${userId}/notes`, { body: { body: body.trim() } });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setBody("");
    setError(null);
    toast.success("Note added");
    router.refresh();
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <FormField id="note-body" label="Add a note" error={error ?? undefined} hint="Only admins can see notes.">
        {(aria) => (
          <Textarea {...aria} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
        )}
      </FormField>
      <Button type="submit" variant="outline" size="sm" disabled={busy}>
        {busy && <Loader2 aria-hidden className="animate-spin" />} Save note
      </Button>
    </form>
  );
}
