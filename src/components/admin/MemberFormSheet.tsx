"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/api-client";

export interface MemberFormValues {
  id?: string;
  name: string;
  email: string;
  phone: string | null;
  role: "MEMBER" | "VOLUNTEER" | "ADMIN";
  city: string | null;
  country: string | null;
  isRemote: boolean;
  teamId: string | null;
}

interface MemberFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: { id: string; name: string }[];
  /** Edit this person; omit to add someone new. */
  initial?: MemberFormValues | null;
  onSaved: () => void;
}

const EMPTY: MemberFormValues = {
  name: "",
  email: "",
  phone: null,
  role: "MEMBER",
  city: null,
  country: "Nigeria",
  isRemote: false,
  teamId: null,
};

/**
 * Add member form and profile edit (spec 7.4 members). Roles beyond member and volunteer live
 * on Roles and titles. Give it a new `key` each time it opens so it starts from `initial`.
 */
export function MemberFormSheet({ open, onOpenChange, teams, initial, onSaved }: MemberFormSheetProps) {
  const editing = !!initial?.id;
  const [v, setV] = React.useState<MemberFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof MemberFormValues>(k: K, val: MemberFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const change = (o: boolean) => {
    if (o) {
      setV(initial ?? EMPTY);
      setErrors({});
    }
    onOpenChange(o);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.name.trim().length < 2) errs.name = "Enter the full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errs.email = "Enter a valid email address.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const payload = {
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone?.trim() ?? "",
      city: v.city?.trim() ?? "",
      country: v.country?.trim() ?? "",
      isRemote: v.isRemote,
      teamId: v.teamId,
      ...(editing ? {} : { role: v.role }),
    };
    const r = editing
      ? await apiRequest(`/api/v1/admin/members/${initial!.id}`, { method: "PATCH", body: payload })
      : await apiRequest("/api/v1/admin/members", { body: payload });
    setBusy(false);
    if (!r.ok) {
      if (r.code === "NO_CHANGE") {
        onOpenChange(false);
        return;
      }
      return setErrors(r.fields ?? (r.code === "EMAIL_IN_USE" ? { email: r.message } : { form: r.message }));
    }
    toast.success(editing ? "Profile saved" : `${v.name.trim()} added`, {
      description: editing ? undefined : "We emailed them a link to choose a password.",
    });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{editing ? `Edit ${initial!.name}` : "Add a member"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Changes are kept in the audit log. A new email address must be confirmed again."
              : "They are active straight away and get an email to choose a password."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="space-y-4 px-4 pb-6">
          {errors.form && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {errors.form}
            </p>
          )}
          <FormField id="mf-name" label="Full name" error={errors.name} required>
            {(aria) => (
              <Input {...aria} value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
            )}
          </FormField>
          <FormField id="mf-email" label="Email" error={errors.email} required>
            {(aria) => (
              <Input
                {...aria}
                type="email"
                value={v.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField id="mf-phone" label="Phone" error={errors.phone} hint="Optional, for example +234 803 123 4567">
            {(aria) => (
              <Input {...aria} type="tel" value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            )}
          </FormField>
          {!editing && (
            <FormField id="mf-role" label="Role" required>
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={v.role}
                  onChange={(e) => set("role", e.target.value as "MEMBER" | "VOLUNTEER")}
                >
                  <option value="MEMBER">Member</option>
                  <option value="VOLUNTEER">Volunteer</option>
                </NativeSelect>
              )}
            </FormField>
          )}
          <FormField id="mf-team" label="Team">
            {(aria) => (
              <NativeSelect {...aria} value={v.teamId ?? ""} onChange={(e) => set("teamId", e.target.value || null)}>
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="mf-city" label="City" error={errors.city}>
              {(aria) => <Input {...aria} value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} />}
            </FormField>
            <FormField id="mf-country" label="Country" error={errors.country}>
              {(aria) => <Input {...aria} value={v.country ?? ""} onChange={(e) => set("country", e.target.value)} />}
            </FormField>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-(--radius-md) border border-border p-3">
            <div>
              <Label htmlFor="mf-remote" className="font-medium">
                Remote member
              </Label>
              <p id="mf-remote-hint" className="text-xs text-muted-foreground">
                Lives away from Lagos: Saturday check-in is not expected.
              </p>
            </div>
            <Switch
              id="mf-remote"
              aria-describedby="mf-remote-hint"
              checked={v.isRemote}
              onCheckedChange={(c) => set("isRemote", c)}
            />
          </div>
          <Button type="submit" variant="role" className="w-full" disabled={busy}>
            {busy && <Loader2 aria-hidden className="animate-spin" />} {editing ? "Save changes" : "Add member"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
