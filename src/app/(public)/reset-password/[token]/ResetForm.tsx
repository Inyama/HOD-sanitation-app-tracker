"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/empty-state";
import { PasswordInput, StrengthMeter } from "@/components/auth/PasswordField";
import { apiRequest } from "@/lib/api-client";
import { newPassword } from "@/lib/validation/auth";

const schema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match." });

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [check, setCheck] = React.useState<
    { state: "loading" } | { state: "ok"; email: string } | { state: "bad"; message: string }
  >({ state: "loading" });
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState, control } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });
  const pw = useWatch({ control, name: "password" });

  React.useEffect(() => {
    apiRequest<{ email: string }>(`/api/v1/auth/reset?token=${encodeURIComponent(token)}`).then((r) =>
      setCheck(r.ok ? { state: "ok", email: r.email } : { state: "bad", message: r.message }),
    );
  }, [token]);

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    const r = await apiRequest("/api/v1/auth/reset", { body: { token, password } });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.replace("/login?reason=reset");
  });

  if (check.state === "loading") return <LoadingState rows={2} label="Checking your link" />;
  if (check.state === "bad") {
    return (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-3 text-[0.9375rem] text-(--status-absent-fg)">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {check.message}
        </p>
        <Button asChild variant="role" className="w-full">
          <Link href="/forgot-password">Ask for a new link</Link>
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">
        For the account <span className="font-medium text-foreground">{check.email}</span>
      </p>
      {error && (
        <p role="alert" className="text-sm text-(--status-absent-fg)">
          {error}
        </p>
      )}
      <FormField id="password" label="New password" error={formState.errors.password?.message} required>
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("password")} />}
      </FormField>
      <StrengthMeter password={pw ?? ""} />
      <FormField id="confirm" label="Type it again" error={formState.errors.confirm?.message} required>
        {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...register("confirm")} />}
      </FormField>
      <Button type="submit" variant="role" size="lg" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 aria-hidden className="animate-spin" />} Save new password
      </Button>
    </form>
  );
}
