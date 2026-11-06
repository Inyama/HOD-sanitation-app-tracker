import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/ui/empty-state";
import { VerifyEmail } from "./VerifyEmail";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Confirm your email">
      <Suspense fallback={<LoadingState rows={2} label="Loading" />}>
        <VerifyEmail />
      </Suspense>
    </AuthShell>
  );
}
