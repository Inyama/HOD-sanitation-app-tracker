"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

export interface IssueItem {
  id: string;
  area: string;
  urgency: "LOW" | "MEDIUM" | "URGENT";
  note: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  photoUrl: string | null;
  createdLabel: string;
}

const AREAS = ["Sanctuary", "Restrooms", "Entrance", "Kitchen", "Outdoors", "Other"];
const URGENCY: { value: IssueItem["urgency"]; label: string; hint: string; cls: string }[] = [
  { value: "LOW", label: "Low", hint: "When someone has time", cls: "bg-muted text-foreground" },
  { value: "MEDIUM", label: "Medium", hint: "This week", cls: "bg-(--status-late-bg) text-(--status-late-fg)" },
  {
    value: "URGENT",
    label: "Urgent",
    hint: "Safety risk, today",
    cls: "bg-(--status-absent-bg) text-(--status-absent-fg)",
  },
];
const STEPS: IssueItem["status"][] = ["OPEN", "IN_PROGRESS", "RESOLVED"];
const STEP_LABEL = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved" };

function Tracker({ status }: { status: IssueItem["status"] }) {
  const at = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1" aria-label={`Status: ${STEP_LABEL[status]}`}>
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-1 text-xs" aria-current={i === at ? "step" : undefined}>
          <span
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-full font-bold",
              i <= at ? "bg-role-btn text-role-btn-fg" : "bg-muted text-muted-foreground",
            )}
          >
            {i < at || status === "RESOLVED" ? <Check aria-hidden className="size-3.5" /> : i + 1}
          </span>
          <span className={cn(i === at ? "font-semibold" : "text-muted-foreground")}>{STEP_LABEL[s]}</span>
          {i < STEPS.length - 1 && (
            <span aria-hidden className={cn("h-0.5 flex-1 rounded", i < at ? "bg-role" : "bg-mist")} />
          )}
        </li>
      ))}
    </ol>
  );
}

/** Report an issue (spec 7.3): photo with preview, area, urgency, note; status tracker. */
export function IssueReporter({ items }: { items: IssueItem[] }) {
  const router = useRouter();
  const [area, setArea] = React.useState("Sanctuary");
  const [urgency, setUrgency] = React.useState<IssueItem["urgency"]>("MEDIUM");
  const [note, setNote] = React.useState("");
  const [photo, setPhoto] = React.useState<{ url: string; preview: string; name: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const preview = URL.createObjectURL(f);
    setUploading(true);
    const r = await uploadFile(f, "issue-photo");
    setUploading(false);
    if (!r.ok) {
      URL.revokeObjectURL(preview);
      setErrors((x) => ({ ...x, photo: r.message }));
    } else {
      setErrors((x) => ({ ...x, photo: "" }));
      setPhoto({ url: r.url, preview, name: r.name });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 10) return setErrors({ note: "Describe the problem (at least 10 characters)." });
    setBusy(true);
    const r = await apiRequest("/api/v1/issues", {
      body: { area, urgency, note: note.trim(), photoUrl: photo?.url ?? null },
    });
    setBusy(false);
    if (!r.ok) return setErrors(r.fields ?? { form: r.message });
    setErrors({});
    setNote("");
    setPhoto(null);
    toast.success("Issue reported", {
      description:
        urgency === "URGENT"
          ? "Marked urgent: admins see it at the top of their list."
          : "Thank you. An admin will pick it up.",
    });
    router.refresh();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <GlassCard>
        <GlassCardHeader title="Report a problem" description="Spills, breakages, missing supplies or safety risks." />
        <form onSubmit={submit} noValidate className="space-y-4">
          {errors.form && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {errors.form}
            </p>
          )}
          <FormField id="i-area" label="Area" required>
            {(aria) => (
              <NativeSelect {...aria} value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Urgency</legend>
            <div className="grid grid-cols-3 gap-2">
              {URGENCY.map((u) => (
                <label
                  key={u.value}
                  className={cn(
                    "flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-(--radius-sm) border px-2 py-1.5 text-center",
                    urgency === u.value ? "border-role ring-2 ring-role/40" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value={u.value}
                    checked={urgency === u.value}
                    onChange={() => setUrgency(u.value)}
                    className="sr-only"
                  />
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", u.cls)}>{u.label}</span>
                  <span className="mt-0.5 text-[0.6875rem] text-muted-foreground">{u.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <FormField id="i-note" label="What is wrong?" error={errors.note} required>
            {(aria) => (
              <Textarea {...aria} rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            )}
          </FormField>
          <div className="space-y-1.5">
            <p className="text-sm font-medium" id="i-photo-label">
              Photo (optional)
            </p>
            {photo ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
                <img
                  src={photo.preview}
                  alt="Preview of the photo you chose"
                  className="h-40 rounded-(--radius-md) border border-border object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute top-1 right-1"
                  aria-label="Remove photo"
                  onClick={() => setPhoto(null)}
                >
                  <X aria-hidden />
                </Button>
              </div>
            ) : (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-sm) border border-dashed border-border px-3 py-2 text-sm hover:border-role">
                {uploading ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden className="size-4" />
                )}
                {uploading ? "Uploading…" : "Take or choose a photo (2 MB max)"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  className="sr-only"
                  aria-labelledby="i-photo-label"
                  onChange={onPhoto}
                />
              </label>
            )}
            {errors.photo && <p className="text-sm text-(--status-absent-fg)">{errors.photo}</p>}
          </div>
          <Button type="submit" variant="role" size="lg" disabled={busy || uploading}>
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send report
          </Button>
        </form>
      </GlassCard>

      <section aria-labelledby="my-issues" className="space-y-3">
        <h2 id="my-issues" className="text-xl font-semibold">
          My reports
        </h2>
        {items.length === 0 ? (
          <EmptyState
            illustration="broom"
            title="No reports yet"
            description="Problems you report will show here with their progress."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id}>
                <GlassCard padding="sm" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{i.area}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        URGENCY.find((u) => u.value === i.urgency)!.cls,
                      )}
                    >
                      {URGENCY.find((u) => u.value === i.urgency)!.label}
                    </span>
                  </div>
                  <p className="text-sm">{i.note}</p>
                  {i.photoUrl && (
                    <a
                      href={i.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-sm font-medium text-role-strong underline"
                    >
                      View photo
                    </a>
                  )}
                  <Tracker status={i.status} />
                  <p className="text-xs text-muted-foreground">Reported {i.createdLabel}</p>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
