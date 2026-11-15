"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bold, CalendarClock, Eye, Italic, Link2, List, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard } from "@/components/ui/glass-card";
import { RichText } from "@/components/ui/rich-text";
import type { AudienceSpec } from "@/lib/repo/types";
import { apiRequest } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload-client";
import { resolveAudience } from "@/lib/notifications/audience";
import { MESSAGE_MERGE_FIELDS, MESSAGE_TEMPLATES } from "@/lib/notifications/message-templates";
import { fillMergeFields, firstName } from "@/lib/notifications/templates";
import { AudienceBuilder, type AudienceOption } from "./AudienceBuilder";

interface Attachment {
  name: string;
  url: string;
  size: string;
}

const kb = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Compose a message (spec 7.4 item 10). */
export function MessageComposer({
  people,
  teams,
  nextMeeting,
  minSchedule,
}: {
  people: AudienceOption[];
  teams: { id: string; name: string }[];
  nextMeeting: string;
  minSchedule: string;
}) {
  const router = useRouter();
  const [audience, setAudience] = React.useState<AudienceSpec>({ kind: "EVERYONE" });
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [templateKey, setTemplateKey] = React.useState<string | null>(null);
  const [inApp, setInApp] = React.useState(true);
  const [email, setEmail] = React.useState(true);
  const [when, setWhen] = React.useState<"now" | "later">("now");
  const [scheduledFor, setScheduledFor] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [previewId, setPreviewId] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const recipients = React.useMemo(() => resolveAudience(audience, people), [audience, people]);
  const previewPerson = people.find((p) => p.id === (previewId || recipients[0])) ?? null;
  const values = previewPerson
    ? {
        first_name: firstName(previewPerson.name),
        percentage: previewPerson.percent === null ? "–" : String(previewPerson.percent),
        band: previewPerson.bandLabel,
        next_meeting: nextMeeting,
      }
    : {};

  const insert = (before: string, after = "", placeholder = "") => {
    const el = bodyRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const selected = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + selected + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };
  const bullet = () => {
    const el = bodyRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = body.lastIndexOf("\n", s - 1) + 1;
    setBody(body.slice(0, lineStart) + "- " + body.slice(lineStart));
    requestAnimationFrame(() => el.focus());
  };

  const applyTemplate = (key: string) => {
    const t = MESSAGE_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    if ((subject || body) && !window.confirm("Replace the subject and message with this template?")) return;
    setSubject(t.subject);
    setBody(t.body);
    setTemplateKey(t.key);
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files).slice(0, 5 - attachments.length)) {
      const r = await uploadFile(f, "attachment");
      if (!r.ok) toast.error(`${f.name}: ${r.message}`);
      else setAttachments((a) => [...a, { name: r.name, url: r.url, size: kb(r.size ?? f.size) }]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const channels = [...(inApp ? ["IN_APP"] : []), ...(email ? ["EMAIL"] : [])];
    const errs: Record<string, string> = {};
    if (subject.trim().length < 3) errs.subject = "Add a subject.";
    if (body.trim().length < 5) errs.body = "Write the message (at least 5 characters).";
    if (!channels.length) errs.channels = "Choose at least one channel.";
    if (recipients.length === 0) errs.audience = "Nobody matches this audience.";
    if (when === "later" && !scheduledFor) errs.scheduledFor = "Choose when to send it.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await apiRequest<{ recipients: number; scheduled: boolean }>("/api/v1/admin/messages", {
      body: {
        audience,
        subject,
        body,
        channels,
        scheduledFor: when === "later" ? scheduledFor : null,
        attachments,
        templateKey,
      },
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.error(r.message);
    }
    toast.success(
      r.scheduled ? "Message scheduled" : `Message sent to ${r.recipients} ${r.recipients === 1 ? "person" : "people"}`,
    );
    setSubject("");
    setBody("");
    setAttachments([]);
    setTemplateKey(null);
    setWhen("now");
    setScheduledFor("");
    router.refresh();
  };

  return (
    <form onSubmit={send} noValidate className="grid gap-6 xl:grid-cols-[1fr_24rem] [&>*]:min-w-0">
      <GlassCard className="space-y-5">
        <AudienceBuilder people={people} teams={teams} value={audience} onChange={setAudience} />
        {errors.audience && <p className="text-sm text-(--status-absent-fg)">{errors.audience}</p>}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Start from a template</p>
          <div className="flex flex-wrap gap-2">
            {MESSAGE_TEMPLATES.map((t) => (
              <Button
                key={t.key}
                type="button"
                size="sm"
                variant={templateKey === t.key ? "role" : "outline"}
                onClick={() => applyTemplate(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        <FormField id="msg-subject" label="Subject" required error={errors.subject}>
          {(aria) => <Input {...aria} value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} />}
        </FormField>

        <FormField
          id="msg-body"
          label="Message"
          required
          error={errors.body}
          hint="Use **bold**, *italic*, a dash for bullets, and [text](https://link). Merge fields are filled in for each person."
        >
          {(aria) => (
            <div className="rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <div
                className="flex flex-wrap items-center gap-1 border-b border-input p-1.5"
                role="toolbar"
                aria-label="Formatting"
              >
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Bold"
                  onClick={() => insert("**", "**", "bold text")}
                >
                  <Bold aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Italic"
                  onClick={() => insert("*", "*", "italic text")}
                >
                  <Italic aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Bullet list" onClick={bullet}>
                  <List aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Link"
                  onClick={() => insert("[", "](https://)", "link text")}
                >
                  <Link2 aria-hidden />
                </Button>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                {MESSAGE_MERGE_FIELDS.map((f) => (
                  <Button
                    key={f}
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => insert(`{${f}}`)}
                    aria-label={`Insert merge field {${f}}`}
                  >
                    {`{${f}}`}
                  </Button>
                ))}
              </div>
              <Textarea
                {...aria}
                ref={bodyRef}
                rows={9}
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="rounded-t-none border-0 focus-visible:ring-0"
              />
            </div>
          )}
        </FormField>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Attachments</p>
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li
                  key={a.url}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm"
                >
                  <Paperclip aria-hidden className="size-3.5" /> {a.name}{" "}
                  <span className="text-muted-foreground">({a.size})</span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    onClick={() => setAttachments((x) => x.filter((y) => y.url !== a.url))}
                    className="rounded-full p-1 hover:bg-muted"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || attachments.length >= 5}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 aria-hidden className="animate-spin" /> : <Paperclip aria-hidden />} Attach a PDF or
            image
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Attach files"
            onChange={(e) => attach(e.target.files)}
          />
          <p className="text-xs text-muted-foreground">Up to 5 files, 2 MB each.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Channels</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox checked={inApp} onCheckedChange={(v) => setInApp(v === true)} /> In-app
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} /> Email
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <Checkbox disabled checked={false} /> SMS{" "}
              <span className="rounded-full bg-muted px-2 text-xs">Coming soon</span>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <Checkbox disabled checked={false} /> WhatsApp{" "}
              <span className="rounded-full bg-muted px-2 text-xs">Coming soon</span>
            </label>
          </div>
          {errors.channels && <p className="text-sm text-(--status-absent-fg)">{errors.channels}</p>}
          <p className="text-xs text-muted-foreground">
            Email goes only to people who keep email on in their settings.
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">When</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="when"
                checked={when === "now"}
                onChange={() => setWhen("now")}
                className="accent-(--royal-600)"
              />{" "}
              Send now
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="when"
                checked={when === "later"}
                onChange={() => setWhen("later")}
                className="accent-(--royal-600)"
              />{" "}
              Schedule
            </label>
          </div>
          {when === "later" && (
            <FormField
              id="msg-when"
              label="Send at (Lagos time)"
              error={errors.scheduledFor}
              hint="The audience is worked out when it goes out."
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="datetime-local"
                  min={minSchedule}
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="max-w-xs"
                />
              )}
            </FormField>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="submit" variant="role" disabled={busy}>
            {busy ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : when === "later" ? (
              <CalendarClock aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            {when === "later"
              ? "Schedule message"
              : `Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`}
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4 self-start xl:sticky xl:top-24">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Eye aria-hidden className="size-4 text-role-strong" /> Preview as a member
        </h2>
        <label className="block space-y-1.5 text-sm font-medium">
          Preview for
          <NativeSelect
            value={previewPerson?.id ?? ""}
            onChange={(e) => setPreviewId(e.target.value)}
            disabled={recipients.length === 0}
          >
            {recipients.length === 0 && <option value="">Nobody in the audience</option>}
            {people
              .filter((p) => recipients.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </NativeSelect>
        </label>
        <article
          className="space-y-3 rounded-(--radius-md) border border-border bg-background p-4 text-sm"
          aria-label="Message preview"
        >
          <p className="font-heading text-lg font-semibold">{fillMergeFields(subject, values) || "Subject"}</p>
          {body ? (
            <RichText text={fillMergeFields(body, values)} />
          ) : (
            <p className="text-muted-foreground">The message appears here.</p>
          )}
          {attachments.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {attachments.map((a) => (
                <li key={a.url} className="flex items-center gap-1">
                  <Paperclip aria-hidden className="size-3" /> {a.name}
                </li>
              ))}
            </ul>
          )}
        </article>
      </GlassCard>
    </form>
  );
}
