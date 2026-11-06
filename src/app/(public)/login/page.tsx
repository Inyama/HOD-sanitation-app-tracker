import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to HOD Sanitation Hub as a member, volunteer or admin.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to check in, see your attendance and stay in step with the unit."
      footer={
        <p>
          <Link href="/" className="underline underline-offset-4">
            Back to the home page
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
        </p>
      }
    >
      <Suspense fallback={<LoadingState rows={4} label="Loading sign-in" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
