"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, ImageUp, Loader2, MapPin, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { apiRequest } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload-client";
import type { SettingsBody } from "@/lib/validation/admin";
import { MAX_RADIUS_M, MIN_RADIUS_M } from "@/lib/attendance/geofence";
import type { VenuePinPickerProps } from "./VenuePinPickerInner";

const PinPicker = dynamic(() => import("./VenuePinPickerInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" aria-hidden />,
});

function VenuePinPicker(props: VenuePinPickerProps) {
  return (
    <div
      role="region"
      aria-label="Map of the venue pin. Drag the pin or click the map to move it; or type the coordinates below."
      className="relative isolate z-0 h-72 overflow-hidden rounded-(--radius-lg) border border-border"
    >
      <PinPicker {...props} />
    </div>
  );
}

const ZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Europe/London",
  "Europe/Dublin",
  "America/New_York",
  "America/Toronto",
  "Asia/Dubai",
];

interface SettingsFormProps {
  initial: SettingsBody;
  demoMode: boolean;
}

/** Settings (spec 7.4 item 17, Super Admin only). One save; the audit log lists every field that changed. */
export function SettingsForm({ initial, demoMode }: SettingsFormProps) {
  const router = useRouter();
  const [v, setV] = React.useState<SettingsBody>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const patch = (p: Partial<SettingsBody>) => setV((s) => ({ ...s, ...p }));
  const venue = (p: Partial<SettingsBody["venue"]>) => setV((s) => ({ ...s, venue: { ...s.venue, ...p } }));
  const num = (s: string) => (s === "" ? Number.NaN : Number(s));
  const err = (k: string) => errors[k];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await apiRequest<{ changes: string[] }>("/api/v1/admin/settings", { method: "PATCH", body: v });
    setBusy(false);
    if (!r.ok) {
      if (r.code === "NO_CHANGE") return toast.info("Nothing has changed.");
      setErrors(r.fields ?? { form: r.message });
      toast.error(r.fields ? "Some settings need attention." : r.message);
      return;
    }
    setErrors({});
    toast.success("Settings saved", { description: r.changes.join(", ") });
    router.refresh();
  };

  const chooseLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const r = await uploadFile(file, "logo");
    setUploading(false);
    if (!r.ok) return setErrors((s) => ({ ...s, "branding.logoUrl": r.message }));
    setV((s) => ({ ...s, branding: { ...s.branding, logoUrl: r.url } }));
  };

  const resetDemo = async () => {
    const r = await apiRequest("/api/v1/demo/reset", { body: {} });
    if (!r.ok) return toast.error(r.message);
    toast.success("Demo data restored", { description: "Everything is back to the original seed." });
    router.refresh();
  };

  const n = (
    id: string,
    label: string,
    value: number,
    onChange: (x: number) => void,
    hint?: string,
    unit?: string,
    min?: number,
    max?: number,
  ) => (
    <FormField id={id} label={label} error={err(id.replace(/^s-/, "").replaceAll("-", "."))} hint={hint}>
      {(aria) => (
        <div className="flex items-center gap-2">
          <Input
            {...aria}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={Number.isNaN(value) ? "" : value}
            onChange={(e) => onChange(num(e.target.value))}
          />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      )}
    </FormField>
  );

  return (
    <form onSubmit={save} noValidate className="space-y-6 pb-24">
      {errors.form && (
        <p role="alert" className="flex items-center gap-2 text-sm text-(--status-absent-fg)">
          <CircleAlert aria-hidden className="size-4" /> {errors.form}
        </p>
      )}

      <GlassCard>
        <GlassCardHeader
          title={
            <span className="flex items-center gap-2">
              <MapPin aria-hidden className="size-5 text-role-strong" /> Venue and geofence
            </span>
          }
          description="Check-in works only inside the circle. Drag the pin, click the map or type the coordinates."
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <VenuePinPicker
            lat={v.venue.lat}
            lng={v.venue.lng}
            radiusM={v.venue.radiusM}
            name={v.venue.name}
            onMove={(lat, lng) => venue({ lat, lng, verified: false })}
          />
          <div className="space-y-4">
            <FormField id="s-venue-name" label="Venue name" error={err("venue.name")}>
              {(aria) => <Input {...aria} value={v.venue.name} onChange={(e) => venue({ name: e.target.value })} />}
            </FormField>
            <FormField id="s-venue-address" label="Address" error={err("venue.address")}>
              {(aria) => (
                <Input {...aria} value={v.venue.address} onChange={(e) => venue({ address: e.target.value })} />
              )}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="s-venue-lat" label="Latitude" error={err("venue.lat")}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    step="0.000001"
                    value={Number.isNaN(v.venue.lat) ? "" : v.venue.lat}
                    onChange={(e) => venue({ lat: num(e.target.value), verified: false })}
                  />
                )}
              </FormField>
              <FormField id="s-venue-lng" label="Longitude" error={err("venue.lng")}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    step="0.000001"
                    value={Number.isNaN(v.venue.lng) ? "" : v.venue.lng}
                    onChange={(e) => venue({ lng: num(e.target.value), verified: false })}
                  />
                )}
              </FormField>
            </div>
            <FormField
              id="s-venue-radiusM"
              label={`Geofence radius: ${v.venue.radiusM} m`}
              error={err("venue.radiusM")}
              hint={`Between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} metres. 100 m suits most halls.`}
            >
              {(aria) => (
                <input
                  {...aria}
                  type="range"
                  min={MIN_RADIUS_M}
                  max={MAX_RADIUS_M}
                  step={10}
                  value={v.venue.radiusM}
                  onChange={(e) => venue({ radiusM: Number(e.target.value) })}
                  className="h-11 w-full accent-(--role)"
                />
              )}
            </FormField>
            <div className="flex items-start justify-between gap-4 rounded-(--radius-md) border border-border p-3">
              <div>
                <Label htmlFor="s-verified" className="font-medium">
                  Pin confirmed on site
                </Label>
                <p id="s-verified-hint" className="text-xs text-muted-foreground">
                  Turn on after checking the pin while standing at the venue. Moving the pin turns this off.
                </p>
              </div>
              <Switch
                id="s-verified"
                aria-describedby="s-verified-hint"
                checked={v.venue.verified}
                onCheckedChange={(c) => venue({ verified: c })}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <GlassCard>
          <GlassCardHeader
            title="Check-in rules"
            description="Accuracy applies at once. Window times are the defaults for new meetings."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {n(
              "s-maxAccuracyM",
              "Accuracy threshold",
              v.maxAccuracyM,
              (x) => patch({ maxAccuracyM: x }),
              "Readings less precise than this are refused.",
              "m",
              10,
              200,
            )}
            {n(
              "s-graceMinutes",
              "Grace period",
              v.graceMinutes,
              (x) => patch({ graceMinutes: x }),
              "Minutes after the start still counted On time.",
              "min",
              0,
              30,
            )}
            {n(
              "s-openBeforeMinutes",
              "Check-in opens",
              v.openBeforeMinutes,
              (x) => patch({ openBeforeMinutes: x }),
              "Minutes before the start.",
              "min",
              15,
              180,
            )}
            {n(
              "s-closeAfterMinutes",
              "Check-in closes",
              v.closeAfterMinutes,
              (x) => patch({ closeAfterMinutes: x }),
              "Minutes after the start.",
              "min",
              30,
              240,
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader
            title="Percentages"
            description="Changes apply to every screen, report and email straight away."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {n(
              "s-bandThresholds-gold",
              "Gold from",
              v.bandThresholds.gold,
              (x) => patch({ bandThresholds: { ...v.bandThresholds, gold: x } }),
              undefined,
              "%",
              1,
              100,
            )}
            {n(
              "s-bandThresholds-green",
              "Green from",
              v.bandThresholds.green,
              (x) => patch({ bandThresholds: { ...v.bandThresholds, green: x } }),
              undefined,
              "%",
              1,
              100,
            )}
            {n(
              "s-bandThresholds-amber",
              "Amber from",
              v.bandThresholds.amber,
              (x) => patch({ bandThresholds: { ...v.bandThresholds, amber: x } }),
              undefined,
              "%",
              1,
              100,
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="s-lateWeight"
              label="Late counts as"
              error={err("lateWeight")}
              hint="Half means a Late arrival earns half a meeting."
            >
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={String(v.lateWeight)}
                  onChange={(e) => patch({ lateWeight: Number(e.target.value) })}
                >
                  <option value="1">A full meeting</option>
                  <option value="0.75">Three quarters</option>
                  <option value="0.5">Half a meeting</option>
                </NativeSelect>
              )}
            </FormField>
            {n(
              "s-atRiskPercent",
              "At risk below",
              v.atRiskPercent,
              (x) => patch({ atRiskPercent: x }),
              undefined,
              "%",
              1,
              99,
            )}
            {n(
              "s-atRiskConsecutiveAbsences",
              "Or absent in a row",
              v.atRiskConsecutiveAbsences,
              (x) => patch({ atRiskConsecutiveAbsences: x }),
              undefined,
              "times",
              2,
              10,
            )}
            {n(
              "s-lowAttendancePercent",
              "Low-attendance alert below",
              v.lowAttendancePercent,
              (x) => patch({ lowAttendancePercent: x }),
              undefined,
              "%",
              1,
              99,
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader
            title="Reminder defaults"
            description="Quiet hours delay optional messages only; meeting reminders always go out. Each reminder is managed on Automation."
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField id="s-quiet-start" label="Quiet hours start" error={err("quietHours.start")}>
              {(aria) => (
                <Input
                  {...aria}
                  type="time"
                  value={v.quietHours.start}
                  onChange={(e) => patch({ quietHours: { ...v.quietHours, start: e.target.value } })}
                />
              )}
            </FormField>
            <FormField id="s-quiet-end" label="Quiet hours end" error={err("quietHours.end")}>
              {(aria) => (
                <Input
                  {...aria}
                  type="time"
                  value={v.quietHours.end}
                  onChange={(e) => patch({ quietHours: { ...v.quietHours, end: e.target.value } })}
                />
              )}
            </FormField>
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader title="Data and region" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {n(
              "s-locationRetentionMonths",
              "Keep location data for",
              v.locationRetentionMonths,
              (x) => patch({ locationRetentionMonths: x }),
              "Coordinates older than this are deleted.",
              "months",
              1,
              36,
            )}
            <FormField
              id="s-timezone"
              label="Unit time zone"
              error={err("timezone")}
              hint="Meeting rules always run on Lagos time."
            >
              {(aria) => (
                <NativeSelect {...aria} value={v.timezone} onChange={(e) => patch({ timezone: e.target.value })}>
                  {[...new Set([v.timezone, ...ZONES])].map((z) => (
                    <option key={z} value={z}>
                      {z.replace("_", " ")}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader title="Branding" description="Used in emails and PDF reports." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(["primary", "accent"] as const).map((k) => (
              <FormField
                key={k}
                id={`s-branding-${k}`}
                label={k === "primary" ? "Primary colour" : "Accent colour"}
                error={err(`branding.${k}`)}
              >
                {(aria) => (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${k === "primary" ? "Primary" : "Accent"} colour picker`}
                      value={v.branding[k]}
                      onChange={(e) => patch({ branding: { ...v.branding, [k]: e.target.value } })}
                      className="size-11 shrink-0 cursor-pointer rounded-(--radius-sm) border border-border bg-transparent"
                    />
                    <Input
                      {...aria}
                      value={v.branding[k]}
                      onChange={(e) => patch({ branding: { ...v.branding, [k]: e.target.value } })}
                      maxLength={7}
                    />
                  </div>
                )}
              </FormField>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served by the API, not next/image */}
            <img
              src={v.branding.logoUrl}
              alt="Current logo"
              className="size-16 rounded-full border border-border bg-white object-contain p-1"
            />
            <label
              htmlFor="s-logo"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              {uploading ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <ImageUp aria-hidden className="size-4" />
              )}{" "}
              Choose a new logo
            </label>
            <input
              id="s-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={chooseLogo}
            />
            {err("branding.logoUrl") && (
              <p role="alert" className="w-full text-sm text-(--status-absent-fg)">
                {err("branding.logoUrl")}
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader title="Demo mode" />
          <p className="text-sm">
            Demo mode is <span className="font-semibold">{demoMode ? "on" : "off"}</span>. It shows the Demo ribbon, the
            simulate controls and the email outbox, and accepts any six-digit code for admin two-factor.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            It is switched by the <code className="rounded bg-muted px-1">NEXT_PUBLIC_DEMO_MODE</code> setting when the
            app is deployed, so it cannot be turned on by accident in the live app.
          </p>
          {demoMode && (
            <Button type="button" variant="outline" className="mt-4" onClick={resetDemo}>
              <RotateCcw aria-hidden /> Restore the demo data
            </Button>
          )}
        </GlassCard>
      </div>

      <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-end gap-3 rounded-(--radius-lg) border border-border bg-card/95 p-3 shadow-soft backdrop-blur md:bottom-4">
        <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || busy}
          onClick={() => {
            setV(initial);
            setErrors({});
          }}
        >
          Undo changes
        </Button>
        <Button type="submit" variant="role" disabled={!dirty || busy}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />} Save settings
        </Button>
      </div>
    </form>
  );
}
