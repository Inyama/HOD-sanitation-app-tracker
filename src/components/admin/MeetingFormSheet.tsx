"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/api-client";
import type { MeetingDefaults } from "@/lib/admin/meetings";

type MeetingType = "SATURDAY" | "THURSDAY_PRAYER" | "SPECIAL";
type Method = "GEO" | "SHEET" | "BOTH";

export interface EditableMeeting {
  id: string;
  type: MeetingType;
  title: string;
  date: string;
  time: string;
  durationMin: number;
  method: Method;
  openBeforeMin: number;
  closeAfterMin: number;
  graceMinutes: number;
  radiusM: number | null;
  requireQr: boolean;
}

interface FormState {
  type: MeetingType;
  title: string;
  date: string;
  time: string;
  durationMin: number;
  method: Method;
  openBeforeMin: number;
  closeAfterMin: number;
  graceMinutes: number;
  useVenueRadius: boolean;
  radiusM: number;
  requireQr: boolean;
  repeatWeeks: number;
}

const TYPE_LABEL: Record<MeetingType, string> = {
  SATURDAY: "Saturday Sanitation Meeting",
  THURSDAY_PRAYER: "Thursday Prayer Meeting",
  SPECIAL: "Special event",
};

/** Create or edit a meeting (spec 7.4 item 7). Editing keeps the date; use Reschedule to move it. */
export function MeetingFormSheet({
  open,
  onOpenChange,
  editing,
  defaults,
  venueRadius,
  today,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: EditableMeeting | null;
  defaults: Record<MeetingType, MeetingDefaults>;
  venueRadius: number;
  today: string;
  onSaved: (message: string) => void;
}) {
  const fresh = React.useCallback(
    (type: MeetingType = "SPECIAL"): FormState => {
      const d = defaults[type];
      return {
        type,
        title: d.title,
        date: today,
        time: d.time,
        durationMin: d.durationMin,
        method: d.method,
        openBeforeMin: d.openBeforeMin,
        closeAfterMin: d.closeAfterMin,
        graceMinutes: d.graceMinutes,
        useVenueRadius: true,
        radiusM: venueRadius,
        requireQr: false,
        repeatWeeks: 1,
      };
    },
    [defaults, today, venueRadius],
  );
  // The parent remounts this sheet (new key) each time it opens, so state starts fresh.
  const [f, setF] = React.useState<FormState>(() =>
    editing
      ? {
          type: editing.type,
          title: editing.title,
          date: editing.date,
          time: editing.time,
          durationMin: editing.durationMin,
          method: editing.method,
          openBeforeMin: editing.openBeforeMin,
          closeAfterMin: editing.closeAfterMin,
          graceMinutes: editing.graceMinutes,
          useVenueRadius: editing.radiusM === null,
          radiusM: editing.radiusM ?? venueRadius,
          requireQr: editing.requireQr,
          repeatWeeks: 1,
        }
      : fresh(),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const sheet = f.method === "SHEET";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    const common = {
      title: f.title,
      durationMin: f.durationMin,
      method: f.method,
      openBeforeMin: f.openBeforeMin,
      closeAfterMin: f.closeAfterMin,
      graceMinutes: f.graceMinutes,
      radiusM: sheet || f.useVenueRadius ? null : f.radiusM,
      requireQr: !sheet && f.requireQr,
    };
    const r = editing
      ? await apiRequest(`/api/v1/admin/meetings/${editing.id}`, {
          method: "PATCH",
          body: { action: "edit", changes: common },
        })
      : await apiRequest<{ ids: string[] }>("/api/v1/admin/meetings", {
          body: { ...common, type: f.type, date: f.date, time: f.time, repeatWeeks: f.repeatWeeks },
        });
    setBusy(false);
    if (!r.ok) {
      if (r.fields)
        setErrors(Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k.replace(/^changes\./, ""), v])));
      setFormError(r.message);
      return;
    }
    onOpenChange(false);
    onSaved(
      editing ? "Meeting updated" : f.repeatWeeks > 1 ? `${f.repeatWeeks} weekly meetings created` : "Meeting created",
    );
  };

  const num = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, Number(e.target.value) as never);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">
            {editing ? `Edit ${editing.title}` : "New meeting or event"}
          </SheetTitle>
          <SheetDescription>
            Times are Lagos time. Reminders follow the start time automatically
            {editing ? "; use Reschedule to move the date or time." : "."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="space-y-4 px-4 pb-6">
          {!editing && (
            <FormField id="m-type" label="Type" required>
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={f.type}
                  onChange={(e) => setF({ ...fresh(e.target.value as MeetingType), date: f.date })}
                >
                  {(Object.keys(TYPE_LABEL) as MeetingType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
          <FormField id="m-title" label="Title" required error={errors.title}>
            {(aria) => (
              <Input
                {...aria}
                value={f.title}
                maxLength={100}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Deep Clean Day"
              />
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="m-date"
              label="Date"
              required
              error={errors.date}
              hint={editing ? "Use Reschedule to change." : undefined}
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="date"
                  min={today}
                  value={f.date}
                  disabled={!!editing}
                  onChange={(e) => set("date", e.target.value)}
                />
              )}
            </FormField>
            <FormField id="m-time" label="Start time" required error={errors.time}>
              {(aria) => (
                <Input
                  {...aria}
                  type="time"
                  value={f.time}
                  disabled={!!editing}
                  onChange={(e) => set("time", e.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="m-duration" label="Length (minutes)" error={errors.durationMin}>
              {(aria) => (
                <Input
                  {...aria}
                  type="number"
                  min={15}
                  max={720}
                  step={15}
                  value={f.durationMin}
                  onChange={num("durationMin")}
                />
              )}
            </FormField>
            <FormField id="m-method" label="Tracking" hint="Location check-in, attendee sheet, or both.">
              {(aria) => (
                <NativeSelect {...aria} value={f.method} onChange={(e) => set("method", e.target.value as Method)}>
                  <option value="GEO">Location check-in</option>
                  <option value="SHEET">Attendee sheet</option>
                  <option value="BOTH">Both</option>
                </NativeSelect>
              )}
            </FormField>
          </div>
          {!sheet && (
            <fieldset className="space-y-3 rounded-(--radius-md) border border-border p-3">
              <legend className="px-1 text-sm font-semibold">Check-in window</legend>
              <div className="grid grid-cols-3 gap-3">
                <FormField id="m-open" label="Opens (min before)" error={errors.openBeforeMin}>
                  {(aria) => (
                    <Input
                      {...aria}
                      type="number"
                      min={0}
                      max={180}
                      value={f.openBeforeMin}
                      onChange={num("openBeforeMin")}
                    />
                  )}
                </FormField>
                <FormField id="m-close" label="Closes (min after)" error={errors.closeAfterMin}>
                  {(aria) => (
                    <Input
                      {...aria}
                      type="number"
                      min={30}
                      max={240}
                      value={f.closeAfterMin}
                      onChange={num("closeAfterMin")}
                    />
                  )}
                </FormField>
                <FormField id="m-grace" label="Grace (min)" error={errors.graceMinutes}>
                  {(aria) => (
                    <Input
                      {...aria}
                      type="number"
                      min={0}
                      max={30}
                      value={f.graceMinutes}
                      onChange={num("graceMinutes")}
                    />
                  )}
                </FormField>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox checked={f.useVenueRadius} onCheckedChange={(v) => set("useVenueRadius", v === true)} />
                Use the venue radius ({venueRadius} m)
              </label>
              {!f.useVenueRadius && (
                <FormField id="m-radius" label="Geofence radius (metres)" error={errors.radiusM} hint="50 to 300 m.">
                  {(aria) => (
                    <Input
                      {...aria}
                      type="number"
                      min={50}
                      max={300}
                      step={10}
                      value={f.radiusM}
                      onChange={num("radiusM")}
                    />
                  )}
                </FormField>
              )}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox checked={f.requireQr} onCheckedChange={(v) => set("requireQr", v === true)} />
                Also require the marshal&apos;s rotating code
              </label>
            </fieldset>
          )}
          {!editing && (
            <FormField
              id="m-repeat"
              label="Repeat weekly"
              hint="1 means a single meeting. Up to 12 weeks."
              error={errors.repeatWeeks}
            >
              {(aria) => (
                <Input {...aria} type="number" min={1} max={12} value={f.repeatWeeks} onChange={num("repeatWeeks")} />
              )}
            </FormField>
          )}
          {formError && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {formError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="role" disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} {editing ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
