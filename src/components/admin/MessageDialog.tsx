"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";

interface MessageDialogProps {
  people: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSubject?: string;
  defaultBody?: string;
  onSent?: () => void;
}

/** Quick message to chosen people (in-app and email). The full Messaging center comes in Phase 7. */
export function MessageDialog({
  people,
  open,
  onOpenChange,
  defaultSubject = "",
  defaultBody = "",
  onSent,
}: MessageDialogProps) {
  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState(defaultBody);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const change = (o: boolean) => {
    if (o) {
      setSubject(defaultSubject);
      setBody(defaultBody);
      setErrors({});
    }
    onOpenChange(o);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (subject.trim().length < 3) errs.subject = "Add a subject.";
    if (body.trim().length < 5) errs.body = "Write the message (at least 5 characters).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await apiRequest<{ recipients: number }>("/api/v1/admin/messages", {
      body: { userIds: people.map((p) => p.id), subject: subject.trim(), body: body.trim() },
    });
    setBusy(false);
    if (!r.ok) return setErrors(r.fields ?? { form: r.message });
    toast.success(`Message sent to ${r.recipients} ${r.recipients === 1 ? "person" : "people"}`);
    onOpenChange(false);
    onSent?.();
  };

  const names = people.map((p) => p.name);
  const to = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Send a message</DialogTitle>
          <DialogDescription>To {to}. They get it in the app and by email.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {errors.form && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {errors.form}
            </p>
          )}
          <FormField id="msg-subject" label="Subject" error={errors.subject} required>
            {(aria) => <Input {...aria} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />}
          </FormField>
          <FormField
            id="msg-body"
            label="Message"
            error={errors.body}
            hint="{first_name} becomes each person's first name."
            required
          >
            {(aria) => (
              <Textarea {...aria} rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
            )}
          </FormField>
          <Button type="submit" variant="role" className="w-full" disabled={busy}>
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send message
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
