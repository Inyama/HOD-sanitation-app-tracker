"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Camera,
  Download,
  KeyRound,
  Loader2,
  MapPin,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PasswordInput, StrengthMeter } from "@/components/auth/PasswordField";
import { InstallPrompt } from "./InstallPrompt";
import { apiRequest } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload-client";
import { COUNTRIES, LANGUAGES } from "@/lib/validation/auth";
import type { NotifPrefs } from "@/lib/repo/types";

export interface SettingsProfile {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  language: string;
  avatarUrl: string | null;
  isRemote: boolean;
  deletionRequestedAt: string | null;
}

export interface LocationUse {
  id: string;
  when: string;
  meeting: string;
  distanceM: number | null;
  accuracyM: number | null;
  coords: string;
}

const ZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Toronto",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bell;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard as="section" aria-label={title}>
      <GlassCardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon aria-hidden className="size-5 text-role-strong" /> {title}
          </span>
        }
        description={description}
      />
      {children}
    </GlassCard>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <Label htmlFor={id} className="flex-1 font-normal">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export function SettingsPanels({
  profile,
  prefs: initialPrefs,
  locations,
}: {
  profile: SettingsProfile;
  prefs: NotifPrefs;
  locations: LocationUse[];
}) {
  const router = useRouter();
  const [p, setP] = React.useState(profile);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [prefs, setPrefs] = React.useState(initialPrefs);
  const [pw, setPw] = React.useState({ current: "", next: "" });
  const [pwErrors, setPwErrors] = React.useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [deletion, setDeletion] = React.useState(profile.deletionRequestedAt);
  const zones = ZONES.includes(p.timezone) ? ZONES : [p.timezone, ...ZONES];

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await apiRequest("/api/v1/me", {
      method: "PATCH",
      body: {
        name: p.name,
        phone: p.phone ?? undefined,
        city: p.city ?? undefined,
        country: p.country ?? undefined,
        timezone: p.timezone,
        language: "en",
      },
    });
    setSaving(false);
    if (!r.ok) {
      setErrors(r.fields ?? { form: r.message });
      return;
    }
    setErrors({});
    toast.success("Profile saved");
    router.refresh();
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPhotoBusy(true);
    const up = await uploadFile(f, "avatar");
    if (!up.ok) {
      setPhotoBusy(false);
      toast.error(up.message);
      return;
    }
    const r = await apiRequest("/api/v1/me", { method: "PATCH", body: { avatarUrl: up.url } });
    setPhotoBusy(false);
    if (!r.ok) return toast.error(r.message);
    setP((x) => ({ ...x, avatarUrl: up.url }));
    toast.success("Photo updated");
    router.refresh();
  };

  const removePhoto = async () => {
    const r = await apiRequest("/api/v1/me", { method: "PATCH", body: { avatarUrl: null } });
    if (r.ok) {
      setP((x) => ({ ...x, avatarUrl: null }));
      router.refresh();
    }
  };

  const savePrefs = async (patch: Partial<NotifPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const r = await apiRequest("/api/v1/me/preferences", { method: "PATCH", body: patch });
    if (!r.ok) {
      setPrefs(prefs);
      toast.error(r.fields ? Object.values(r.fields)[0] : r.message);
    } else toast.success("Reminder settings saved");
  };

  const enablePush = async (on: boolean) => {
    if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const perm = await Notification.requestPermission().catch(() => "denied" as NotificationPermission);
      if (perm !== "granted") {
        toast.error("Notifications are blocked in this browser. Allow them in the site settings first.");
        return;
      }
    }
    await savePrefs({ push: on });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    const r = await apiRequest("/api/v1/me/password", { body: pw });
    setPwBusy(false);
    if (!r.ok) {
      setPwErrors(r.fields ?? { form: r.message });
      return;
    }
    setPwErrors({});
    setPw({ current: "", next: "" });
    toast.success("Password changed", { description: "We emailed you a confirmation." });
  };

  const exportData = async () => {
    const res = await fetch("/api/v1/me/data-export", { method: "POST" });
    if (!res.ok) return toast.error("The export could not be prepared.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "my-hod-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Your data was downloaded");
  };

  const requestDeletion = async (cancel: boolean) => {
    const r = await apiRequest<{ deletionRequestedAt: string | null }>("/api/v1/me/delete-request", {
      method: cancel ? "DELETE" : "POST",
      body: cancel ? undefined : {},
    });
    if (!r.ok) return toast.error(r.message);
    setDeletion(r.deletionRequestedAt);
    toast.success(cancel ? "Deletion request cancelled" : "Deletion requested", {
      description: cancel ? undefined : "A unit admin will confirm within 30 days.",
    });
  };

  const quiet = prefs.quietHours ?? { start: "22:00", end: "06:00" };

  return (
    <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
      <Section icon={UserRound} title="Profile" description="Your details and how times are shown to you.">
        <form onSubmit={saveProfile} noValidate className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar name={p.name} size={64} src={p.avatarUrl} />
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium hover:bg-muted pointer-coarse:h-11">
                {photoBusy ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden className="size-4" />
                )}{" "}
                Change photo
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onPhoto} />
              </label>
              {p.avatarUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={removePhoto}>
                  Remove photo
                </Button>
              )}
            </div>
          </div>
          {errors.form && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {errors.form}
            </p>
          )}
          <FormField id="s-name" label="Full name" error={errors.name} required>
            {(aria) => (
              <Input
                {...aria}
                value={p.name}
                onChange={(e) => setP({ ...p, name: e.target.value })}
                autoComplete="name"
              />
            )}
          </FormField>
          <FormField id="s-email" label="Email" hint="Ask a unit admin to change your email.">
            {(aria) => <Input {...aria} value={p.email} readOnly className="bg-muted" />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="s-phone" label="Phone" error={errors.phone}>
              {(aria) => (
                <Input
                  {...aria}
                  type="tel"
                  value={p.phone ?? ""}
                  onChange={(e) => setP({ ...p, phone: e.target.value })}
                  autoComplete="tel"
                />
              )}
            </FormField>
            <FormField id="s-city" label="City" error={errors.city}>
              {(aria) => (
                <Input {...aria} value={p.city ?? ""} onChange={(e) => setP({ ...p, city: e.target.value })} />
              )}
            </FormField>
            <FormField id="s-country" label="Country" error={errors.country}>
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={p.country ?? "Nigeria"}
                  onChange={(e) => setP({ ...p, country: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField
              id="s-tz"
              label="Time zone"
              error={errors.timezone}
              hint="Meeting times are shown in this zone, with Lagos time alongside."
            >
              {(aria) => (
                <NativeSelect {...aria} value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace("_", " ")}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
          <FormField id="s-lang" label="Language" hint="French, Spanish and Yoruba are coming soon.">
            {(aria) => (
              <NativeSelect {...aria} value="en" disabled={false} onChange={() => undefined}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value} disabled={!l.available}>
                    {l.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <Button type="submit" variant="role" disabled={saving}>
            {saving && <Loader2 aria-hidden className="animate-spin" />} Save profile
          </Button>
        </form>
      </Section>

      <div className="space-y-5">
        <Section icon={Bell} title="Reminders" description="Meeting reminders and account emails always stay on.">
          <div className="divide-y divide-border">
            <SwitchRow id="p-inapp" label="In-app notifications" hint="Always on" checked disabled />
            <SwitchRow
              id="p-email"
              label="Email"
              hint="For the weekly summary and encouragement messages"
              checked={prefs.email}
              onChange={(v) => savePrefs({ email: v })}
            />
            <SwitchRow
              id="p-push"
              label="Push notifications on this device"
              hint="Reminders even when the app is closed"
              checked={prefs.push}
              onChange={enablePush}
            />
            <SwitchRow
              id="p-weekly"
              label="Weekly summary"
              hint="Sunday at 6 pm (Lagos)"
              checked={prefs.weeklySummary}
              onChange={(v) => savePrefs({ weeklySummary: v })}
            />
            <SwitchRow
              id="p-nudges"
              label="Encouragement and follow-ups"
              hint="After an absence, or if your attendance drops"
              checked={prefs.nudges}
              onChange={(v) => savePrefs({ nudges: v })}
            />
          </div>
          <fieldset className="mt-3 space-y-2">
            <legend className="text-sm font-medium">Quiet hours (optional messages wait until they end)</legend>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="q-start" className="text-xs">
                  From
                </Label>
                <input
                  id="q-start"
                  type="time"
                  value={quiet.start}
                  onChange={(e) => setPrefs({ ...prefs, quietHours: { ...quiet, start: e.target.value } })}
                  className="h-11 rounded-lg border border-input bg-surface px-3"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="q-end" className="text-xs">
                  To
                </Label>
                <input
                  id="q-end"
                  type="time"
                  value={quiet.end}
                  onChange={(e) => setPrefs({ ...prefs, quietHours: { ...quiet, end: e.target.value } })}
                  className="h-11 rounded-lg border border-input bg-surface px-3"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => savePrefs({ quietHours: prefs.quietHours ?? quiet })}
              >
                Save quiet hours
              </Button>
            </div>
          </fieldset>
        </Section>

        <Section icon={KeyRound} title="Change password">
          <form onSubmit={changePassword} noValidate className="space-y-3">
            {pwErrors.form && (
              <p role="alert" className="text-sm text-(--status-absent-fg)">
                {pwErrors.form}
              </p>
            )}
            <FormField id="pw-current" label="Current password" error={pwErrors.current} required>
              {(aria) => (
                <PasswordInput
                  {...aria}
                  value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })}
                  autoComplete="current-password"
                />
              )}
            </FormField>
            <FormField id="pw-next" label="New password" error={pwErrors.next} hint="At least 10 characters." required>
              {(aria) => (
                <PasswordInput
                  {...aria}
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  autoComplete="new-password"
                />
              )}
            </FormField>
            <StrengthMeter password={pw.next} />
            <Button type="submit" variant="outline" disabled={pwBusy || !pw.current || !pw.next}>
              {pwBusy && <Loader2 aria-hidden className="animate-spin" />} Change password
            </Button>
          </form>
        </Section>
      </div>

      <Section
        icon={ShieldCheck}
        title="Privacy"
        description="Your location is read only when you press Check in, and kept for 12 months."
      >
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MapPin aria-hidden className="size-4" /> When your location was used
        </h3>
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your location has not been used yet.</p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Location history"
            className="max-h-64 overflow-auto rounded-(--radius-sm) border border-border"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">Check-ins that used your location</caption>
              <thead className="sticky top-0 bg-muted/95 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    When
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Distance
                  </th>
                  <th scope="col" className="hidden px-3 py-2 sm:table-cell">
                    Coordinates
                  </th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      {l.when}
                      <span className="block text-xs text-muted-foreground">{l.meeting}</span>
                    </td>
                    <td className="tabular px-3 py-2">
                      {l.distanceM === null ? "–" : `${Math.round(l.distanceM)} m`}
                      {l.accuracyM !== null && (
                        <span className="block text-xs text-muted-foreground">±{Math.round(l.accuracyM)} m</span>
                      )}
                    </td>
                    <td className="tabular hidden px-3 py-2 text-xs sm:table-cell">{l.coords}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download aria-hidden /> Download my data
          </Button>
          {deletion ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-(--status-late-fg)">
                Deletion requested. An admin will confirm within 30 days.
              </p>
              <Button variant="ghost" size="sm" onClick={() => requestDeletion(true)}>
                Cancel request
              </Button>
            </div>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 aria-hidden /> Request account deletion
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading text-xl">Delete your account?</DialogTitle>
                  <DialogDescription>
                    A unit admin will confirm the request within 30 days. Your account is then removed, kept for 30 days
                    in case of a mistake, and deleted. You can cancel before then.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Keep my account</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive" onClick={() => requestDeletion(false)}>
                      Request deletion
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </Section>

      <Section icon={Smartphone} title="Install the app">
        <InstallPrompt />
      </Section>
    </div>
  );
}
