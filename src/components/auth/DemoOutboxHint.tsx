import Link from "next/link";
import { Inbox } from "lucide-react";
import { isDemoMode } from "@/lib/env";

/** Demo mode: emails go to an in-app outbox instead of a real inbox. */
export function DemoOutboxHint({ what = "the email" }: { what?: string }) {
  if (!isDemoMode()) return null;
  return (
    <p className="flex items-start gap-2 rounded-(--radius-sm) border border-dashed border-gold-500/60 bg-gold-100/60 p-3 text-sm text-navy-900 dark:bg-gold-500/10 dark:text-gold-100">
      <Inbox aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        Demo mode: no real emails are sent. Open{" "}
        <Link href="/dev/outbox" className="font-semibold underline">
          the demo outbox
        </Link>{" "}
        to find {what}.
      </span>
    </p>
  );
}
