import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/ui/empty-state";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use at least 10 characters. A mix of letters, numbers and symbols is strongest."
    >
      <Suspense fallback={<LoadingState rows={3} label="Checking your link" />}>
        <ResetLoader params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function ResetLoader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetForm token={token} />;
}
