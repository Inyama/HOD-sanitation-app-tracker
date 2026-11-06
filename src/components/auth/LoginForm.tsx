"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck, Sparkles, TriangleAlert, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "./PasswordField";
import { apiRequest, type ApiFailure } from "@/lib/api-client";
import { isDemoMode } from "@/lib/env";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/data/seed/people";
import type { LoginTab } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address, like name@example.com."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

const TABS: { value: LoginTab; label: string; blurb: string }[] = [
  { value: "member", label: "Member", blurb: "Check in, see your attendance and reminders." },
  { value: "volunteer", label: "Volunteer", blurb: "Duties, events, service hours and your member view." },
  { value: "admin", label: "Admin", blurb: "Unit leaders. A two-factor code is required." },
];

const chipsFor: Record<LoginTab, string[]> = {
  member: ["adebayo", "chioma", "ngozi", "emeka", "tobi", "ruth", "samuel", "victor"],
  volunteer: ["grace", "michael"],
  admin: ["daniel", "funke", "esther", "joshua", "naomi"],
};

const CHIP_NOTES: Record<string, string> = {
  adebayo: "88%, streak 6",
  chioma: "52%, amber",
  ngozi: "exactly 90%",
  emeka: "89.7%",
  tobi: "new joiner",
  ruth: "remote, London",
  samuel: "pending approval",
  victor: "suspended",
  grace: "Team Lead, Marshal",
  michael: "Supplies Keeper",
  daniel: "Super Admin",
  funke: "Unit Admin",
  esther: "Attendance Officer",
  joshua: "Comms Officer",
  naomi: "Auditor",
};

const REASONS: Record<string, string> = {
  idle: "You were signed out after 8 hours without activity. Please sign in again.",
  expired: "Your session has expired. Please sign in again.",
  reset: "Your password has been changed. Sign in with your new password.",
  "signed-out": "You have been signed out.",
};

function ErrorBox({ error, onResend }: { error: ApiFailure; onResend?: () => void }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-(--radius-sm) border border-(--status-absent)/40 bg-(--status-absent-bg) p-3 text-sm text-(--status-absent-fg)"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p>{error.message}</p>
        {error.code === "PENDING_APPROVAL" && (
          <Link href="/pending" className="font-semibold underline">
            What happens next
          </Link>
        )}
        {error.code === "EMAIL_NOT_VERIFIED" && onResend && (
          <button type="button" onClick={onResend} className="cursor-pointer font-semibold underline">
            Send the link again
          </button>
        )}
        {error.code === "LOCKED" && (
          <Link href="/forgot-password" className="font-semibold underline">
            Reset your password
          </Link>
        )}
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = (["member", "volunteer", "admin"] as const).find((t) => t === params.get("tab")) ?? "member";
  const [tab, setTab] = React.useState<LoginTab>(initialTab);
  const [step, setStep] = React.useState<"password" | "code">("password");
  const [error, setError] = React.useState<ApiFailure | null>(null);
  const [notice, setNotice] = React.useState<string | null>(REASONS[params.get("reason") ?? ""] ?? null);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const next = params.get("next") ?? undefined;
  const demo = isDemoMode();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });
  const { register, handleSubmit, setValue, formState, getValues, control } = form;
  const remember = useWatch({ control, name: "remember" });

  const go = (to: string) => {
    router.replace(to);
    router.refresh();
  };

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    const r = await apiRequest<{ next?: string; requiresTwoFactor?: boolean }>("/api/v1/auth/login", {
      body: { email: v.email, password: v.password, remember: v.remember, tab, next },
    });
    setBusy(false);
    if (!r.ok) {
      setError(r);
      return;
    }
    if (r.requiresTwoFactor) {
      setStep("code");
      return;
    }
    go(r.next ?? "/member");
  });

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setCodeError("Enter the six-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    const r = await apiRequest<{ next?: string }>("/api/v1/auth/2fa/verify", { body: { code, next } });
    setBusy(false);
    if (!r.ok) {
      if (r.code === "EXPIRED") {
        setStep("password");
        setError(r);
      } else if (r.code === "INVALID_CODE") setCodeError(r.message);
      else setError(r);
      return;
    }
    go(r.next ?? "/admin");
  };

  const resend = async () => {
    await apiRequest("/api/v1/auth/verify-email", { body: { resendFor: getValues("email") } });
    setError(null);
    setNotice("We sent a new confirmation link. Check your inbox.");
  };

  const fill = (key: string) => {
    const acct = DEMO_ACCOUNTS.find((a) => a.key === key)!;
    setValue("email", acct.email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setError(null);
  };

  const email = useWatch({ control, name: "email" });

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-5" noValidate>
        <div className="flex items-start gap-3 rounded-(--radius-md) bg-gold-100 p-4 text-sm text-navy-900 dark:bg-gold-500/15 dark:text-gold-100">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>
            Two-factor sign-in for <span className="font-semibold">{email}</span>. Open your authenticator app and enter
            the six-digit code.
          </p>
        </div>
        {error && <ErrorBox error={error} />}
        <FormField
          id="code"
          label="Six-digit code"
          error={codeError ?? undefined}
          hint={demo ? "Demo mode: any six digits work, for example 123456." : undefined}
          required
        >
          {(aria) => (
            <Input
              {...aria}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              className="tabular text-center text-2xl tracking-[0.4em]"
            />
          )}
        </FormField>
        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <KeyRound aria-hidden />} Verify and sign in
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("password");
            setCode("");
          }}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" /> Use a different account
        </button>
      </form>
    );
  }

  const active = TABS.find((t) => t.value === tab)!;

  const panel = (
    <>
      <p className="text-sm text-muted-foreground">{active.blurb}</p>

      {notice && (
        <div
          role="status"
          className="flex gap-3 rounded-(--radius-sm) border border-(--status-excused)/40 bg-(--status-excused-bg) p-3 text-sm text-(--status-excused-fg)"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>{notice}</p>
        </div>
      )}
      {error && <ErrorBox error={error} onResend={resend} />}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="email" label="Email" error={formState.errors.email?.message} required>
          {(aria) => <Input {...aria} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
        </FormField>
        <FormField id="password" label="Password" error={formState.errors.password?.message} required>
          {(aria) => <PasswordInput {...aria} autoComplete="current-password" {...register("password")} />}
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-h-11 items-center gap-2.5">
            <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setValue("remember", v === true)} />
            <Label htmlFor="remember" className="font-normal">
              Remember this device
            </Label>
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-medium text-role-strong underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 aria-hidden className="animate-spin" />}
          Sign in as {active.label.toLowerCase()}
        </Button>
      </form>

      {tab === "admin" ? (
        <p className="text-sm text-muted-foreground">
          Admin accounts are created by invitation only.
          {demo && (
            <>
              {" "}
              Demo invitation:{" "}
              <Link href="/accept-invite/demo-invite-2026" className="font-medium text-role-strong underline">
                accept as Communications Officer
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link href={`/signup/${tab}`} className="font-medium text-role-strong underline-offset-4 hover:underline">
            Sign up as a {tab}
          </Link>
          {tab === "member" && (
            <>
              {" "}
              or{" "}
              <Link
                href="/signup/volunteer"
                className="font-medium text-role-strong underline-offset-4 hover:underline"
              >
                as a volunteer
              </Link>
            </>
          )}
          .
        </p>
      )}

      {demo && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Sparkles aria-hidden className="size-3.5" /> Demo accounts (password {DEMO_PASSWORD})
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Fill in a demo account">
            {chipsFor[tab].map((key) => {
              const a = DEMO_ACCOUNTS.find((x) => x.key === key)!;
              const tag = CHIP_NOTES[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => fill(key)}
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer flex-col items-start rounded-(--radius-sm) border border-border bg-surface px-3 py-1 text-left hover:border-role",
                    email === a.email && "border-role bg-role-soft",
                  )}
                >
                  <span className="text-sm font-medium">{a.name.replace("Pastor ", "")}</span>
                  {tag && <span className="text-[0.6875rem] text-muted-foreground">{tag}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-5" data-role={tab}>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as LoginTab);
          setError(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-3" aria-label="Sign in as">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="min-h-10">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} forceMount hidden={tab !== t.value} className="mt-5 space-y-5">
            {tab === t.value && panel}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
