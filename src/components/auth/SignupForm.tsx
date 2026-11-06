"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { PasswordInput, StrengthMeter } from "./PasswordField";
import { apiRequest, type ApiFailure } from "@/lib/api-client";
import { AVAILABILITY, COUNTRIES, LANGUAGES, signupBody, type SignupBody } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

const ZONES = ["Sanctuary", "Restrooms", "Entrance", "Kitchen", "Outdoors"];

type FormValues = Omit<SignupBody, "consentLocation" | "consentReminders"> & {
  consentLocation: boolean;
  consentReminders: boolean;
};

function CheckList({
  legend,
  options,
  value,
  onChange,
  name,
}: {
  legend: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  name: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const id = `${name}-${o.replace(/\W+/g, "-").toLowerCase()}`;
          const on = value.includes(o);
          return (
            <label
              key={o}
              htmlFor={id}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm",
                on ? "border-role bg-role-soft font-medium" : "border-border bg-surface",
              )}
            >
              <Checkbox
                id={id}
                checked={on}
                onCheckedChange={(c) => onChange(c === true ? [...value, o] : value.filter((x) => x !== o))}
              />
              {o}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SignupForm({ role }: { role: "MEMBER" | "VOLUNTEER" }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<ApiFailure | null>(null);
  const isVolunteer = role === "VOLUNTEER";
  const form = useForm<FormValues>({
    resolver: zodResolver(signupBody) as never,
    mode: "onBlur",
    defaultValues: {
      role,
      name: "",
      email: "",
      phone: "",
      password: "",
      country: "Nigeria",
      city: "Lagos",
      language: "en",
      unitCode: "",
      consentLocation: false,
      consentReminders: false,
      zones: [],
      availability: [],
      notes: "",
    },
  });
  const { register, handleSubmit, formState, control, setError } = form;
  const errors = formState.errors;
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const r = await apiRequest("/api/v1/auth/signup", { body: values });
    if (!r.ok) {
      if (r.fields) {
        for (const [k, msg] of Object.entries(r.fields)) setError(k as keyof FormValues, { message: msg });
      }
      setServerError(r);
      return;
    }
    router.push(`/verify-email?sent=1&email=${encodeURIComponent(values.email.trim().toLowerCase())}`);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" data-role={isVolunteer ? "volunteer" : "member"}>
      {serverError && !serverError.fields && (
        <div
          role="alert"
          className="flex gap-3 rounded-(--radius-sm) border border-(--status-absent)/40 bg-(--status-absent-bg) p-3 text-sm text-(--status-absent-fg)"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>{serverError.message}</p>
        </div>
      )}
      {Object.keys(errors).length > 0 && formState.isSubmitted && (
        <p role="alert" className="text-sm font-medium text-(--status-absent-fg)">
          Some fields need attention. Check the messages below.
        </p>
      )}

      <section aria-labelledby="about-you" className="grid gap-4 sm:grid-cols-2">
        <h2 id="about-you" className="text-base font-semibold sm:col-span-2">
          About you
        </h2>
        <FormField id="name" label="Full name" error={errors.name?.message} required className="sm:col-span-2">
          {(aria) => <Input {...aria} autoComplete="name" {...register("name")} />}
        </FormField>
        <FormField id="email" label="Email" error={errors.email?.message} required>
          {(aria) => <Input {...aria} type="email" inputMode="email" autoComplete="email" {...register("email")} />}
        </FormField>
        <FormField
          id="phone"
          label="Phone"
          error={errors.phone?.message}
          hint="Include your country code, for example +234."
          required
        >
          {(aria) => <Input {...aria} type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />}
        </FormField>
        <FormField id="country" label="Country" error={errors.country?.message} required>
          {(aria) => (
            <NativeSelect {...aria} autoComplete="country-name" {...register("country")}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="city" label="City" error={errors.city?.message} required>
          {(aria) => <Input {...aria} autoComplete="address-level2" {...register("city")} />}
        </FormField>
        <FormField id="language" label="Preferred language" error={errors.language?.message}>
          {(aria) => (
            <NativeSelect {...aria} {...register("language")}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value} disabled={!l.available}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          id="unitCode"
          label="Unit code (optional)"
          error={errors.unitCode?.message}
          hint="If a leader gave you a code, enter it here."
        >
          {(aria) => <Input {...aria} autoComplete="off" {...register("unitCode")} />}
        </FormField>
      </section>

      {isVolunteer && (
        <section aria-labelledby="serving" className="space-y-4">
          <h2 id="serving" className="text-base font-semibold">
            How you would like to serve
          </h2>
          <Controller
            control={control}
            name="zones"
            render={({ field }) => (
              <CheckList
                legend="Zones you would like to serve in"
                name="zones"
                options={ZONES}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="availability"
            render={({ field }) => (
              <CheckList
                legend="When you are usually available"
                name="availability"
                options={AVAILABILITY}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            id="notes"
            label="Anything else we should know? (optional)"
            error={errors.notes?.message}
            hint="Skills, experience or access needs."
          >
            {(aria) => <Textarea {...aria} rows={3} {...register("notes")} />}
          </FormField>
        </section>
      )}

      <section aria-labelledby="security" className="space-y-3">
        <h2 id="security" className="text-base font-semibold">
          Password
        </h2>
        <FormField
          id="password"
          label="Create a password"
          error={errors.password?.message}
          hint="At least 10 characters."
          required
        >
          {(aria) => (
            <PasswordInput
              {...aria}
              aria-describedby={[aria["aria-describedby"], "password-strength"].filter(Boolean).join(" ")}
              autoComplete="new-password"
              {...register("password")}
            />
          )}
        </FormField>
        <StrengthMeter id="password-strength" password={password ?? ""} />
      </section>

      <section aria-labelledby="consent" className="space-y-3">
        <h2 id="consent" className="text-base font-semibold">
          Your consent
        </h2>
        {(
          [
            [
              "consentLocation",
              "I agree that my location is read only when I press Check in, to confirm I am at the venue.",
              errors.consentLocation?.message,
            ],
            [
              "consentReminders",
              "I agree to receive meeting reminders by email and in the app.",
              errors.consentReminders?.message,
            ],
          ] as const
        ).map(([name, text, err]) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <div className="space-y-1">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-(--radius-sm) border p-3",
                    err ? "border-(--status-absent)" : "border-border",
                  )}
                >
                  <Checkbox
                    id={name}
                    className="mt-0.5"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `${name}-error` : undefined}
                  />
                  <Label htmlFor={name} className="leading-snug font-normal">
                    {text}
                  </Label>
                </div>
                {err && (
                  <p id={`${name}-error`} className="text-sm text-(--status-absent-fg)">
                    {err}
                  </p>
                )}
              </div>
            )}
          />
        ))}
        <p className="text-xs text-muted-foreground">
          Read how we use and protect your data in our{" "}
          <Link href="/privacy" className="font-medium underline">
            privacy notice
          </Link>
          .
        </p>
      </section>

      <Button type="submit" variant="role" size="lg" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 aria-hidden className="animate-spin" />}
        Create my {isVolunteer ? "volunteer" : "member"} account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login?tab=${isVolunteer ? "volunteer" : "member"}`}
          className="font-medium text-role-strong underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
