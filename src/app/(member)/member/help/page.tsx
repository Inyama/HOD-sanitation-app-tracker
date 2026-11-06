import type { Metadata } from "next";
import { ChevronDown, Clock3, HandHeart, Mail, MapPin, Shirt, ShieldCheck } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui/page-header";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";

export const metadata: Metadata = { title: "Help and guidelines" };

const FAQS = [
  {
    q: "How is my attendance percentage worked out?",
    a: "On time and Late both count as attended. Your percentage is the meetings you attended divided by the meetings you attended plus the ones you missed. Approved excuses are left out, and so are cancelled meetings and anything before you joined.",
  },
  {
    q: "What if my phone cannot find my location?",
    a: "Move outdoors or near a window and try again. If it still fails, a Check-in Marshal can record you by hand at the gate; it shows as Manual on your history.",
  },
  {
    q: "I live outside Lagos. Do I need to check in on Saturdays?",
    a: "No. Members marked Remote by an admin are not expected at the Saturday venue. Thursday prayer is recorded from the attendee sheet whether you join in person or online.",
  },
  {
    q: "How do Thursday prayer meetings get recorded?",
    a: "An admin uploads the attendee list after the meeting. Use the same email address you signed up with when you join online, so you are matched correctly.",
  },
  {
    q: "I was there but my record says Absent.",
    a: "Send an excuse request with details, or message a unit admin. Admins can correct a record; every change is logged with a reason.",
  },
  {
    q: "Can I turn off reminders?",
    a: "Meeting reminders and account emails stay on, because they are part of the service. The weekly summary and encouragement messages can be turned off in Settings, and optional messages are never sent between 10 pm and 6 am your time.",
  },
];

export default async function HelpPage() {
  await requirePage("/member/help");
  const settings = await repo().settings.get();
  return (
    <>
      <PageHeader title="Help and guidelines" subtitle="How the unit works, and answers to common questions." />
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <GlassCard>
          <GlassCardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck aria-hidden className="size-5 text-role-strong" /> Unit rules
              </span>
            }
          />
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>Serve with excellence and a cheerful heart; every space we clean prepares a place for worship.</li>
            <li>Follow your Team Lead and Zone Captain on the day.</li>
            <li>Use cleaning chemicals only as shown in training, with gloves.</li>
            <li>Report hazards (spills, broken glass, gas smells) at once.</li>
            <li>Respect the sanctuary: quiet voices while others pray.</li>
          </ul>
        </GlassCard>
        <GlassCard>
          <GlassCardHeader
            title={
              <span className="flex items-center gap-2">
                <Clock3 aria-hidden className="size-5 text-role-strong" /> Lateness policy
              </span>
            }
          />
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>Saturday meetings start at 9:30 am (Lagos). Check-in opens at 8:30 am.</li>
            <li>
              Arrive and check in by 9:30 am
              {settings.graceMinutes ? ` (plus a ${settings.graceMinutes}-minute grace period)` : ""} to be On time.
            </li>
            <li>After that you are Late until check-in closes at 11:30 am.</li>
            <li>
              Late still counts as attended{settings.lateWeight < 1 ? `, at ${settings.lateWeight * 100}% weight` : ""};
              your on-time rate is shown separately.
            </li>
            <li>Cannot come? Send an excuse request from 7 days before to 7 days after.</li>
          </ul>
        </GlassCard>
        <GlassCard>
          <GlassCardHeader
            title={
              <span className="flex items-center gap-2">
                <Shirt aria-hidden className="size-5 text-role-strong" /> What to bring
              </span>
            }
          />
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>Your phone, charged, with location turned on.</li>
            <li>Comfortable clothes and closed shoes.</li>
            <li>Gloves if you have them; spares are at the Supplies desk.</li>
            <li>Water, and a smile.</li>
          </ul>
        </GlassCard>
      </div>

      <section aria-labelledby="faq-title" className="mt-8">
        <h2 id="faq-title" className="mb-3 text-xl font-semibold">
          Frequently asked questions
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-card">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-4 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <GlassCard tone="accent" className="mt-8 grid gap-4 sm:grid-cols-3">
        <p className="flex items-start gap-2 text-sm">
          <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-role-strong" />
          <span>
            Email the unit admins at{" "}
            <a href="mailto:sanitation@hod-demo.example.com" className="font-medium underline">
              sanitation@hod-demo.example.com
            </a>
          </span>
        </p>
        <p className="flex items-start gap-2 text-sm">
          <HandHeart aria-hidden className="mt-0.5 size-4 shrink-0 text-role-strong" /> Speak to your Team Lead or any
          Check-in Marshal on Saturday.
        </p>
        <p className="flex items-start gap-2 text-sm">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-role-strong" /> 7 Surulere Industrial Road, Off
          Adeniyi Jones, Ikeja, Lagos.
        </p>
      </GlassCard>
    </>
  );
}
