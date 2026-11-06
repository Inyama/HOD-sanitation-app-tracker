import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Clock3, Download, Trash2, Bell, ShieldCheck, Globe2, Mail } from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export const metadata: Metadata = {
  title: "Privacy and location notice",
  description: "How HOD Sanitation Hub uses your location and personal data, how long it is kept, and your rights.",
};

const sections = [
  {
    icon: MapPin,
    title: "When we read your location",
    body: [
      "Only when you press Check in for a Saturday meeting or event. We never track you in the background, and the app does not ask for your location at any other time.",
      "At that moment we record your coordinates, how accurate your phone says they are, your distance from the venue and the time. That is how we confirm you are at the venue.",
      "If your location is not available, a Check-in Marshal can record you by hand instead.",
    ],
  },
  {
    icon: Clock3,
    title: "How long we keep it",
    body: [
      "Location details from check-ins are deleted after 12 months. Your attendance record (date, meeting, status) is kept while your account is active so your percentage stays correct.",
      "If you leave the unit, an admin removes your account; it is kept for 30 days in case of a mistake and then deleted.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "What else we hold and why",
    body: [
      "Your name, email, phone, city and country, so leaders can reach you and reminders arrive at the right local time.",
      "Your attendance, excuse requests, duties and service hours, so you and the unit leaders can see how you are doing.",
      "Only unit admins can see other people's records. Every change an admin makes is recorded in an audit log.",
    ],
  },
  {
    icon: Bell,
    title: "Reminders",
    body: [
      "Meeting reminders and account emails (such as password resets) are part of the service. Weekly summaries and encouragement messages are optional and you can turn them off in Settings.",
      "Optional messages are not sent between 10 pm and 6 am in your time zone.",
    ],
  },
  {
    icon: Download,
    title: "Get a copy of your data",
    body: [
      "In Settings, under Privacy, you can download your data at any time, including your attendance history and any locations recorded.",
    ],
  },
  {
    icon: Trash2,
    title: "Ask us to delete your account",
    body: [
      "In Settings, under Privacy, you can request deletion. An admin confirms it within 30 days. Some records may be kept where the law requires it.",
    ],
  },
  {
    icon: Globe2,
    title: "The rules we follow",
    body: [
      "We handle personal data in line with the Nigeria Data Protection Act 2023 and, for members living elsewhere, rules such as the UK and EU GDPR.",
      "You consented to location use at check-in and to reminders when you signed up. You can withdraw consent by contacting us, though Saturday check-in needs location.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 outline-none sm:px-6 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase dark:text-gold-300">Privacy</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-[2.5rem]">Your privacy and your location</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          In plain language: what we collect, when, why, and what you can ask us to do with it.
        </p>
        <div className="mt-10 space-y-8">
          {sections.map(({ icon: Icon, title, body }) => (
            <section key={title} aria-labelledby={title.replace(/\W+/g, "-")} className="flex gap-4">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-royal-700 dark:bg-royal-600/25 dark:text-sky-100">
                <Icon aria-hidden className="size-5" />
              </span>
              <div className="space-y-2">
                <h2 id={title.replace(/\W+/g, "-")} className="text-xl font-semibold">
                  {title}
                </h2>
                {body.map((p) => (
                  <p key={p} className="text-[0.9375rem] leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <section
          aria-labelledby="contact"
          className="mt-10 rounded-(--radius-lg) border border-border bg-card p-6 shadow-soft"
        >
          <h2 id="contact" className="flex items-center gap-2 text-xl font-semibold">
            <Mail aria-hidden className="size-5 text-role-strong" /> Questions or requests
          </h2>
          <p className="mt-2 text-[0.9375rem]">
            Write to the Sanitation Unit at{" "}
            <a href="mailto:sanitation@hod-demo.example.com" className="font-medium text-role-strong underline">
              sanitation@hod-demo.example.com
            </a>{" "}
            or visit us at 7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Draft notice: final wording to be confirmed by qualified counsel before launch. Last updated 6 November
            2026.
          </p>
        </section>
        <p className="mt-8 text-sm">
          <Link href="/" className="font-medium text-role-strong underline-offset-4 hover:underline">
            Back to the home page
          </Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
