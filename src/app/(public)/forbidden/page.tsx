import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <AuthShell title="You do not have access to this page" subtitle="Your account does not include this area.">
      <div className="space-y-5">
        <p className="flex items-start gap-3 text-[0.9375rem]">
          <ShieldAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-(--status-late)" />
          <span>
            Some screens are only for volunteers, for people with a title such as Check-in Marshal or Team Lead, or for
            certain admin roles. If you think you should have access, ask a unit admin.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="role">
            <Link href="/member">Go to my home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Sign in with another account</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
