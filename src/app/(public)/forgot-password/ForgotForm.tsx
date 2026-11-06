"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { DemoOutboxHint } from "@/components/auth/DemoOutboxHint";
import { apiRequest } from "@/lib/api-client";
import { forgotBody } from "@/lib/validation/auth";

export function ForgotForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(forgotBody) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const r = await apiRequest("/api/v1/auth/forgot", { body: { email } });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="space-y-5" role="status">
        <p className="flex items-start gap-3 text-[0.9375rem]">
          <MailCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-role-strong" />
          <span>
            If an account exists for <span className="font-semibold">{sentTo}</span>, we have sent a link to reset the
            password. It works once and lasts 1 hour.
          </span>
        </p>
        <DemoOutboxHint what="the reset link" />
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && (
        <p role="alert" className="flex gap-2 text-sm text-(--status-absent-fg)">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <FormField id="email" label="Email" error={formState.errors.email?.message} required>
        {(aria) => <Input {...aria} type="email" inputMode="email" autoComplete="email" {...register("email")} />}
      </FormField>
      <Button type="submit" variant="role" size="lg" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 aria-hidden className="animate-spin" />} Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-role-strong underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
