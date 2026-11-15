"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BellRing,
  CalendarClock,
  CircleCheck,
  CircleX,
  Loader2,
  Mail,
  MinusCircle,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Smartphone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { MERGE_FIELDS, fillMergeFields, type MergeValues } from "@/lib/notifications/templates";
import { cn } from "@/lib/utils";
import { EmailPreview } from "./EmailPreview";

export interface RuleRow {
  type: string;
  label: string;
  when: string;
  audience: string;
  optional: boolean;
  available: string[];
  rule: {
    enabled: boolean;
    email: boolean;
    push: boolean;
    subject: string | null;
    title: string | null;
    body: string | null;
  };
  defaults: { subject: string; title: string; body: string };
  template: { subject: string; title: string; body: string };
  sample: MergeValues;
}

export interface DeliveryRow {
  id: string;
  atLabel: string;
  person: string;
  type: string;
  channel: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  attempts: number;
  lastError: string | null;
  retryLabel: string | null;
  subject: string;
}

export interface ScheduleRow {
  key: string;
  label: string;
  atLabel: string;
  meetingTitle: string;
  enabled: boolean;
}

const STATUS = {
  SENT: { label: "Sent", icon: CircleCheck, cls: "text-(--status-ontime-fg)" },
  FAILED: { label: "Failed", icon: CircleX, cls: "text-(--status-absent-fg)" },
  SKIPPED: { label: "Skipped", icon: MinusCircle, cls: "text-muted-foreground" },
};

function TemplateDialog({ row, onClose, onSaved }: { row: RuleRow | null; onClose: () => void; onSaved: () => void }) {
  const [subject, setSubject] = React.useState(row?.template.subject ?? "");
  const [title, setTitle] = React.useState(row?.template.title ?? "");
  const [body, setBody] = React.useState(row?.template.body ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const focused = React.useRef<"subject" | "title" | "body">("body");
  if (!row) return null;
  const v = row.sample;
  const insert = (f: string) => {
    const token = `{${f}}`;
    if (focused.current === "subject") setSubject((s) => s + token);
    else if (focused.current === "title") setTitle((s) => s + token);
    else setBody((s) => s + token);
  };
  const save = async (reset: boolean) => {
    setBusy(true);
    setError(null);
    const same = (a: string, b: string) => a.trim() === b.trim();
    const r = await apiRequest("/api/v1/admin/automation", {
      method: "PATCH",
      body: reset
        ? { target: "rule", type: row.type, subject: null, title: null, body: null }
        : {
            target: "rule",
            type: row.type,
            subject: same(subject, row.defaults.subject) ? null : subject,
            title: same(title, row.defaults.title) ? null : title,
            body: same(body, row.defaults.body) ? null : body,
          },
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    toast.success(reset ? "Back to the built-in wording" : "Template saved");
    onSaved();
    onClose();
  };
  const hasEmail = row.available.includes("EMAIL");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{row.label}</DialogTitle>
          <DialogDescription>
            {row.when}. Merge fields are filled in for each person; times show in their own zone with Lagos time in
            brackets.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="space-y-4">
            {hasEmail && (
              <FormField id="t-subject" label="Email subject">
                {(aria) => (
                  <Input
                    {...aria}
                    value={subject}
                    maxLength={160}
                    onFocus={() => (focused.current = "subject")}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                )}
              </FormField>
            )}
            <FormField id="t-title" label="In-app title">
              {(aria) => (
                <Input
                  {...aria}
                  value={title}
                  maxLength={80}
                  onFocus={() => (focused.current = "title")}
                  onChange={(e) => setTitle(e.target.value)}
                />
              )}
            </FormField>
            <FormField id="t-body" label="Message">
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={7}
                  maxLength={1000}
                  value={body}
                  onFocus={() => (focused.current = "body")}
                  onChange={(e) => setBody(e.target.value)}
                />
              )}
            </FormField>
            <div className="flex flex-wrap gap-1.5" aria-label="Insert a merge field">
              {MERGE_FIELDS.map((f) => (
                <Button key={f} type="button" size="xs" variant="outline" onClick={() => insert(f)}>
                  {`{${f}}`}
                </Button>
              ))}
            </div>
            <div className="rounded-(--radius-md) border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">In-app preview</p>
              <p className="mt-1 font-semibold">{fillMergeFields(title, v)}</p>
              <p className="text-sm">{fillMergeFields(body, v)}</p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-(--status-absent-fg)">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="role" disabled={busy} onClick={() => save(false)}>
                {busy && <Loader2 aria-hidden className="animate-spin" />} Save template
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => save(true)}>
                <RotateCcw aria-hidden /> Use the built-in wording
              </Button>
            </div>
          </div>
          {hasEmail ? (
            <EmailPreview
              subject={fillMergeFields(subject, v)}
              content={{
                preheader: fillMergeFields(body, v).slice(0, 90),
                heading: fillMergeFields(title, v),
                paragraphs: [fillMergeFields(body, v)],
                button: { label: "Open the app", url: "/member" },
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This notification is in-app and push only, so there is no email.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Reminders and automation (spec 7.4 item 11). */
export function AutomationScreen({
  rules,
  escalation,
  schedule,
  deliveries,
  totals,
  types,
  filters,
  lastRun,
}: {
  rules: RuleRow[];
  escalation: { enabled: boolean; absences: number };
  schedule: ScheduleRow[];
  deliveries: DeliveryRow[];
  totals: { sent: number; failed: number; skipped: number; retrying: number };
  types: string[];
  filters: { status: string; type: string };
  lastRun: { atLabel: string | null; text: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<RuleRow | null>(null);
  const [esc, setEsc] = React.useState(escalation);
  const label = new Map(rules.map((r) => [r.type, r.label]));

  const patch = async (key: string, body: Record<string, unknown>, msg: string) => {
    setBusy(key);
    const r = await apiRequest("/api/v1/admin/automation", { method: "PATCH", body });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(msg);
    router.refresh();
  };
  const test = async (row: RuleRow) => {
    setBusy(`test-${row.type}`);
    const r = await apiRequest<{ email: string }>("/api/v1/admin/automation/test", { body: { type: row.type } });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success("Test sent to you", {
      description: row.available.includes("EMAIL")
        ? `In-app now; email ${r.email.toLowerCase()} (see /dev/outbox in demo).`
        : "Check your notifications.",
    });
    router.refresh();
  };
  const run = async () => {
    setBusy("run");
    const r = await apiRequest<{
      summary: { reminders: number; messages: number; closedMeetings: number; escalations: number; retried: number };
    }>("/api/v1/admin/automation/run", { body: {} });
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    const s = r.summary;
    toast.success("Scheduler ran", {
      description: `${s.reminders} reminders, ${s.messages} scheduled messages, ${s.closedMeetings} meetings closed, ${s.escalations} escalations, ${s.retried} retries.`,
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <GlassCard className="space-y-3">
          <GlassCardHeader
            title="Scheduler"
            description="Runs every minute in the live app (cron). In demo mode it also runs as the simulated clock moves."
          />
          <p className="text-sm" aria-live="polite">
            {lastRun.atLabel ? (
              <>
                Last run {lastRun.atLabel}. {lastRun.text}
              </>
            ) : (
              "Not run since the server started."
            )}
          </p>
          <dl className="grid grid-cols-4 gap-2 text-sm">
            {[
              ["Sent", totals.sent],
              ["Failed", totals.failed],
              ["Retrying", totals.retrying],
              ["Skipped", totals.skipped],
            ].map(([k, v]) => (
              <div key={k} className="rounded-(--radius-md) border border-border p-2">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="tabular font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <Button variant="role" disabled={busy !== null} onClick={run}>
            {busy === "run" ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />} Run the scheduler
            now
          </Button>
        </GlassCard>

        <GlassCard className="space-y-3">
          <GlassCardHeader
            title="Escalation rule"
            description="After repeated absences, the person's Team Lead is asked to check in (in-app and email)."
          />
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
            Tell the Team Lead
            <Switch
              checked={esc.enabled}
              onCheckedChange={(v) => setEsc((e) => ({ ...e, enabled: v }))}
              aria-label="Escalation on"
            />
          </label>
          <FormField
            id="esc-n"
            label="After this many absences in a row"
            hint="Checked with the Sunday absence follow-up."
          >
            {(aria) => (
              <Input
                {...aria}
                type="number"
                min={2}
                max={10}
                value={esc.absences}
                onChange={(e) => setEsc((x) => ({ ...x, absences: Number(e.target.value) }))}
                className="max-w-28"
              />
            )}
          </FormField>
          <Button
            variant="outline"
            disabled={busy !== null || (esc.enabled === escalation.enabled && esc.absences === escalation.absences)}
            onClick={() => patch("esc", { target: "escalation", ...esc }, "Escalation rule saved")}
          >
            {busy === "esc" && <Loader2 aria-hidden className="animate-spin" />} Save rule
          </Button>
        </GlassCard>
      </div>

      <section aria-labelledby="rules-title" className="space-y-3">
        <h2 id="rules-title" className="flex items-center gap-2 text-lg font-semibold">
          <BellRing aria-hidden className="size-5 text-role-strong" /> Automated notifications
        </h2>
        <p className="text-sm text-muted-foreground">
          Times follow each meeting&apos;s start, so moving or cancelling a meeting moves or removes its reminders.
          Members cannot turn off meeting reminders; optional ones respect quiet hours.
        </p>
        <ul className="space-y-3">
          {rules.map((r) => (
            <li key={r.type}>
              <GlassCard
                className={cn(
                  "flex flex-col gap-3 lg:flex-row lg:items-center",
                  !r.rule.enabled && "border-dashed bg-muted/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.label}
                    {r.optional && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        Optional for members
                      </span>
                    )}
                    {(r.rule.subject || r.rule.title || r.rule.body) && (
                      <span className="rounded-full bg-role-soft px-2 py-0.5 text-xs font-medium text-role-strong">
                        Custom wording
                      </span>
                    )}
                  </p>
                  <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock aria-hidden className="size-3.5" /> {r.when}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users aria-hidden className="size-3.5" /> {r.audience}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <BellRing aria-hidden className="size-4" /> In-app
                  </span>
                  {r.available.includes("EMAIL") && (
                    <label className="inline-flex min-h-11 items-center gap-2">
                      <Mail aria-hidden className="size-4" /> Email
                      <Switch
                        checked={r.rule.email}
                        disabled={busy !== null || !r.rule.enabled}
                        onCheckedChange={(v) =>
                          patch(
                            r.type,
                            { target: "rule", type: r.type, email: v },
                            `Email ${v ? "on" : "off"} for ${r.label}`,
                          )
                        }
                        aria-label={`Email for ${r.label}`}
                      />
                    </label>
                  )}
                  {r.available.includes("PUSH") && (
                    <label className="inline-flex min-h-11 items-center gap-2">
                      <Smartphone aria-hidden className="size-4" /> Push
                      <Switch
                        checked={r.rule.push}
                        disabled={busy !== null || !r.rule.enabled}
                        onCheckedChange={(v) =>
                          patch(
                            r.type,
                            { target: "rule", type: r.type, push: v },
                            `Push ${v ? "on" : "off"} for ${r.label}`,
                          )
                        }
                        aria-label={`Push for ${r.label}`}
                      />
                    </label>
                  )}
                  <label className="inline-flex min-h-11 items-center gap-2 font-semibold">
                    {r.rule.enabled ? "On" : "Off"}
                    <Switch
                      checked={r.rule.enabled}
                      disabled={busy !== null}
                      onCheckedChange={(v) =>
                        patch(
                          r.type,
                          { target: "rule", type: r.type, enabled: v },
                          `${r.label} ${v ? "switched on" : "switched off"}`,
                        )
                      }
                      aria-label={`${r.label} enabled`}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(r)}
                    aria-label={`Edit the template for ${r.label}`}
                  >
                    <Pencil aria-hidden /> Template
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => test(r)}
                    aria-label={`Send test to me: ${r.label}`}
                  >
                    {busy === `test-${r.type}` ? (
                      <Loader2 aria-hidden className="animate-spin" />
                    ) : (
                      <Send aria-hidden />
                    )}{" "}
                    Send test to me
                  </Button>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr] [&>*]:min-w-0">
        <GlassCard className="space-y-3 self-start">
          <GlassCardHeader title="Coming up" description="The next seven days (Lagos time)." />
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled in the next seven days.</p>
          ) : (
            <ol className="max-h-[32rem] space-y-2 overflow-auto" tabIndex={0} aria-label="Coming reminders">
              {schedule.map((s) => (
                <li
                  key={s.key}
                  className={cn(
                    "rounded-(--radius-md) border border-border px-3 py-2 text-sm",
                    !s.enabled && "border-dashed bg-muted/40",
                  )}
                >
                  <p className="tabular font-semibold">{s.atLabel}</p>
                  <p>
                    {s.label}
                    {!s.enabled && <span className="text-muted-foreground"> (switched off)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.meetingTitle}</p>
                </li>
              ))}
            </ol>
          )}
        </GlassCard>

        <section aria-labelledby="log-title" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="log-title" className="text-lg font-semibold">
              Delivery log
            </h2>
            <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Filter the delivery log">
              <label className="space-y-1 text-xs font-medium">
                Status
                <NativeSelect name="status" defaultValue={filters.status} className="h-10 w-32">
                  <option value="ALL">All</option>
                  <option value="SENT">Sent</option>
                  <option value="FAILED">Failed</option>
                  <option value="SKIPPED">Skipped</option>
                </NativeSelect>
              </label>
              <label className="space-y-1 text-xs font-medium">
                Type
                <NativeSelect name="type" defaultValue={filters.type} className="h-10 w-52">
                  <option value="ALL">All types</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {label.get(t) ?? t.toLowerCase().replace(/_/g, " ")}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button type="submit" size="sm" variant="outline">
                Filter
              </Button>
            </form>
          </div>
          {deliveries.length === 0 ? (
            <p className="rounded-(--radius-md) border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No deliveries match.
            </p>
          ) : (
            <div
              className="overflow-x-auto rounded-(--radius-lg) border border-border bg-card"
              tabIndex={0}
              role="region"
              aria-label="Delivery log entries"
            >
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      When
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Person
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      What
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Channel
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((d) => {
                    const s = STATUS[d.status];
                    return (
                      <tr key={d.id}>
                        <td className="tabular px-3 py-2 whitespace-nowrap">{d.atLabel}</td>
                        <td className="px-3 py-2">{d.person}</td>
                        <td className="max-w-72 px-3 py-2">
                          <span className="block truncate">{d.subject}</span>
                          <span className="block text-xs text-muted-foreground">
                            {label.get(d.type) ?? d.type.toLowerCase().replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {d.channel === "IN_APP" ? "In-app" : d.channel === "EMAIL" ? "Email" : "Push"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-flex items-center gap-1 font-medium", s.cls)}>
                            <s.icon aria-hidden className="size-4" /> {s.label}
                          </span>
                          {d.status === "FAILED" && (
                            <span className="block text-xs text-muted-foreground">
                              {d.attempts} {d.attempts === 1 ? "try" : "tries"}
                              {d.retryLabel ? `, next ${d.retryLabel}` : ", gave up"}
                              {d.lastError ? ` · ${d.lastError}` : ""}
                            </span>
                          )}
                          {d.status === "SKIPPED" && d.lastError && (
                            <span className="block text-xs text-muted-foreground">{d.lastError}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <TemplateDialog
          key={editing.type}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
