"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Loader2, MailCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { DemoOutboxHint } from "@/components/auth/DemoOutboxHint";

type State = { kind: "sent" } | { kind: "verifying" } | { kind: "verified" } | { kind: "error"; message: string };

export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token");
  const email = params.get("email") ?? "";
  const [state, setState] = React.useState<State>(token ? { kind: "verifying" } : { kind: "sent" });
  const [resent, setResent] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    apiRequest("/api/v1/auth/verify-email", { body: { token } }).then((r) =>
      setState(r.ok ? { kind: "verified" } : { kind: "error", message: r.message }),
    );
  }, [token]);

  const resend = async () => {
    if (!email) return;
    await apiRequest("/api/v1/auth/verify-email", { body: { resendFor: email } });
    setResent(true);
  };

  if (state.kind === "verifying") {
    return (
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 aria-hidden className="size-5 animate-spin" /> Confirming your email…
      </p>
    );
  }
  if (state.kind === "verified") {
    return (
      <div className="space-y-5" role="status">
        <p className="flex items-start gap-3 text-[0.9375rem]">
          <CircleCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-success" />
          <span>Thank you, your email is confirmed. A unit admin will now review your request.</span>
        </p>
        <Button asChild variant="role" size="lg" className="w-full">
          <Link href="/pending">See what happens next</Link>
        </Button>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-4">
        <p role="alert" className="flex items-start gap-3 text-[0.9375rem] text-(--status-absent-fg)">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {state.message}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <p className="flex items-start gap-3 text-[0.9375rem]">
        <MailCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-role-strong" />
        <span>
          We sent a confirmation link to <span className="font-semibold">{email || "your email address"}</span>. Open it
          to confirm your email. The link lasts 48 hours.
        </span>
      </p>
      <DemoOutboxHint what="the confirmation link" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={resend} disabled={!email || resent}>
          {resent ? "Sent again" : "Send the link again"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
      <p role="status" className="sr-only">
        {resent ? "A new confirmation link was sent." : ""}
      </p>
    </div>
  );
}
