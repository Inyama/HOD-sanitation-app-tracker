import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/ui/empty-state";
import { AcceptInvite } from "./AcceptInvite";

export const metadata: Metadata = { title: "Accept admin invitation" };

export default function AcceptInvitePage({ params }: PageProps<"/accept-invite/[token]">) {
  return (
    <AuthShell
      wide
      title="Accept your invitation"
      subtitle="Set your password and turn on two-factor sign-in. It takes about two minutes."
    >
      <Suspense fallback={<LoadingState rows={3} label="Checking your invitation" />}>
        <Loader params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function Loader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInvite token={token} />;
}
