import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Hourglass, MailOpen } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Awaiting approval" };

const steps = [
  { icon: CircleCheck, title: "Email confirmed", text: "Your sign-up and email are in.", done: true },
  {
    icon: Hourglass,
    title: "A unit admin reviews your request",
    text: "Usually within two days. They may call you to say hello.",
    done: false,
  },
  {
    icon: MailOpen,
    title: "You get an email",
    text: "As soon as you are approved, you can sign in and check in on Saturday.",
    done: false,
  },
];

export default function PendingPage() {
  return (
    <AuthShell title="Thank you for joining" subtitle="Your account is waiting for approval.">
      <EmptyState illustration="calendar" title="We will be in touch soon" className="px-0 pt-0 pb-4" />
      <ol className="space-y-4" aria-label="What happens next">
        {steps.map(({ icon: Icon, title, text, done }) => (
          <li key={title} className="flex gap-3">
            <span
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-(--status-ontime-bg) text-(--status-ontime-fg)" : "bg-muted text-muted-foreground"}`}
            >
              <Icon aria-hidden className="size-5" />
            </span>
            <div>
              <p className="font-semibold">
                {title}
                {done && <span className="sr-only"> (done)</span>}
              </p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
        <p>
          Questions? Email the unit at{" "}
          <a href="mailto:sanitation@hod-demo.example.com" className="font-medium text-role-strong underline">
            sanitation@hod-demo.example.com
          </a>{" "}
          or speak to a Team Lead after service.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Back to the home page</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
