"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import QRCode from "qrcode";
import { Check, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/empty-state";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { PasswordInput, StrengthMeter } from "@/components/auth/PasswordField";
import { apiRequest } from "@/lib/api-client";
import { newPassword } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

interface Invite {
  email: string;
  levelLabel: string;
  secret: string;
  otpauth: string;
  demo: boolean;
}

const stepOne = z
  .object({
    name: z.string().trim().min(3, "Enter your full name.").max(100),
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match." });

function Steps({ current }: { current: 1 | 2 }) {
  const items = ["Your details", "Two-factor sign-in"];
  return (
    <ol className="mb-6 flex gap-3" aria-label="Progress">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const done = n < current;
        return (
          <li
            key={label}
            aria-current={n === current ? "step" : undefined}
            className="flex flex-1 items-center gap-2 text-sm"
          >
            <span
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                n === current
                  ? "bg-gold-500 text-navy-900"
                  : done
                    ? "bg-success text-white"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check aria-hidden className="size-4" /> : n}
            </span>
            <span className={n === current ? "font-semibold" : "text-muted-foreground"}>
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = React.useState<
    { state: "loading" } | { state: "ok"; data: Invite } | { state: "bad"; message: string }
  >({ state: "loading" });
  const [step, setStep] = React.useState<1 | 2>(1);
  const [details, setDetails] = React.useState<{ name: string; password: string } | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const form = useForm<z.infer<typeof stepOne>>({ resolver: zodResolver(stepOne), mode: "onBlur" });
  const pw = useWatch({ control: form.control, name: "password" });

  React.useEffect(() => {
    apiRequest<Invite>(`/api/v1/auth/accept-invite?token=${encodeURIComponent(token)}`).then((r) => {
      if (!r.ok) return setInvite({ state: "bad", message: r.message });
      setInvite({ state: "ok", data: r });
      QRCode.toString(r.otpauth, { type: "svg", margin: 1, color: { dark: "#0a1a44", light: "#ffffff" } }).then(setQr);
    });
  }, [token]);

  if (invite.state === "loading") return <LoadingState rows={3} label="Checking your invitation" />;
  if (invite.state === "bad") {
    return (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-3 text-[0.9375rem] text-(--status-absent-fg)">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {invite.message}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login?tab=admin">Go to admin sign in</Link>
        </Button>
      </div>
    );
  }
  const inv = invite.data;

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    if (!/^\d{6}$/.test(code)) return setCodeError("Enter the six-digit code from your authenticator app.");
    setBusy(true);
    const r = await apiRequest<{ next: string }>("/api/v1/auth/accept-invite", {
      body: { token, ...details, secret: inv.secret, code },
    });
    setBusy(false);
    if (!r.ok) {
      if (r.fields?.password || r.fields?.name) {
        setStep(1);
      }
      return setCodeError(r.message);
    }
    router.replace(r.next);
    router.refresh();
  };

  return (
    <div data-role="admin">
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-(--radius-md) bg-muted p-3 text-sm">
        <span>
          Invitation for <span className="font-semibold">{inv.email}</span>
        </span>
        <RoleBadge role="admin" detail={inv.levelLabel} />
      </div>
      <Steps current={step} />

      {step === 1 ? (
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((v) => {
            setDetails({ name: v.name, password: v.password });
            setStep(2);
          })}
        >
          <FormField id="name" label="Full name" error={form.formState.errors.name?.message} required>
            {(aria) => <Input {...aria} autoComplete="name" {...form.register("name")} />}
          </FormField>
          <FormField id="password" label="Create a password" error={form.formState.errors.password?.message} required>
            {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...form.register("password")} />}
          </FormField>
          <StrengthMeter password={pw ?? ""} />
          <FormField id="confirm" label="Type it again" error={form.formState.errors.confirm?.message} required>
            {(aria) => <PasswordInput {...aria} autoComplete="new-password" {...form.register("confirm")} />}
          </FormField>
          <Button type="submit" variant="role" size="lg" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={finish} noValidate className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-start">
            <div className="mx-auto w-44 rounded-(--radius-md) border border-border bg-white p-2 sm:w-full">
              {qr ? (
                <div
                  role="img"
                  aria-label="QR code for your authenticator app"
                  className="[&_svg]:h-auto [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
              ) : (
                <div className="aspect-square animate-pulse rounded bg-muted" />
              )}
            </div>
            <div className="space-y-3 text-sm">
              <p className="flex items-start gap-2">
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-role-strong" />
                Scan this QR code with an authenticator app such as Google Authenticator, Microsoft Authenticator or
                1Password.
              </p>
              <p className="text-muted-foreground">Cannot scan? Enter this key by hand:</p>
              <code className="block rounded bg-muted px-2 py-1.5 text-xs break-all">
                {inv.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
            </div>
          </div>
          <FormField
            id="code"
            label="Six-digit code from the app"
            error={codeError ?? undefined}
            hint={inv.demo ? "Demo mode: any six digits work, for example 123456." : undefined}
            required
          >
            {(aria) => (
              <Input
                {...aria}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="tabular text-center text-2xl tracking-[0.4em]"
              />
            )}
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" variant="gold" size="lg" className="flex-1" disabled={busy}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} Turn on two-factor and finish
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
