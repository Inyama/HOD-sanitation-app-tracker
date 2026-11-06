import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  HandHeart,
  MapPin,
  Navigation,
  ShieldCheck,
  Sprout,
  UserPlus,
  HeartHandshake,
  ScrollText,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PhotoCard } from "@/components/brand/PhotoCard";
import { getPhoto } from "@/components/brand/photos";
import { VenueMap } from "@/components/brand/VenueMap";
import { directionsUrl } from "@/lib/venue";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { NextMeetingCountdown } from "@/components/public/NextMeetingCountdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { repo } from "@/lib/repo";

const steps = [
  { icon: UserPlus, title: "Join", text: "Sign up as a member or volunteer. A unit admin welcomes and approves you." },
  {
    icon: MapPin,
    title: "Check in",
    text: "On Saturday, press Check in when you arrive. Your phone confirms you are at the venue.",
  },
  {
    icon: Sprout,
    title: "Grow",
    text: "Watch your attendance, earn badges, take on duties and serve with excellence.",
  },
];

const signIns = [
  { tab: "member", label: "Member", text: "Check in and follow your attendance.", icon: CalendarCheck, role: "member" },
  {
    tab: "volunteer",
    label: "Volunteer",
    text: "Duties, events and service hours.",
    icon: HeartHandshake,
    role: "volunteer",
  },
  { tab: "admin", label: "Admin", text: "Unit leaders, with two-factor sign-in.", icon: ScrollText, role: "admin" },
] as const;

export default function LandingPage() {
  const hero = getPhoto("church-interior");
  return (
    <div className="bg-background">
      <PublicHeader onDark />

      {/* Hero */}
      <section aria-labelledby="hero-title" className="bg-grad-hero relative isolate overflow-hidden text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 opacity-50"
          style={{ backgroundImage: hero.placeholder.gradient }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-conic-gradient(from 200deg at 85% 0%, rgba(255,255,255,.10) 0deg 6deg, transparent 6deg 18deg)",
            }}
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,26,68,.55),rgba(6,15,43,.7))]"
        />
        <div aria-hidden className="absolute -top-24 -right-16 -z-10 size-96 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pb-24">
          <div className="space-y-6">
            <Logo size={84} priority />
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
              Household of David · Sanitation Unit
            </p>
            <h1 id="hero-title" className="text-4xl font-semibold text-balance sm:text-5xl lg:text-[3.25rem]">
              Serving God with excellence, one clean space at a time
            </h1>
            <p className="max-w-xl text-lg text-white/85">
              Check in on Saturdays, keep track of your attendance and stay ready for every duty. Built for our unit in
              Lagos and members around the world.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="gold" size="lg">
                <Link href="/login">
                  Sign in <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link href="/signup/member">Join the unit</Link>
              </Button>
            </div>
          </div>
          <NextMeetingCountdown />
        </div>
      </section>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* Schedule */}
        <section
          id="schedule"
          aria-labelledby="schedule-title"
          className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-16 sm:px-6"
        >
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase dark:text-gold-300">
              When we meet
            </p>
            <h2 id="schedule-title" className="mt-2 text-3xl font-semibold">
              Two meetings every week
            </h2>
            <p className="mt-2 text-muted-foreground">
              All times are Lagos time (West Africa Time, UTC+1). The app shows them in your own time zone too.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-(--radius-lg) border border-border bg-card p-6 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Saturday Sanitation Meeting</h3>
                  <p className="mt-1 text-muted-foreground">Every Saturday at 9:30 am</p>
                </div>
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-sky-100 text-royal-700 dark:bg-royal-600/25 dark:text-sky-100">
                  <MapPin aria-hidden className="size-5" />
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex gap-2">
                  <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-royal-600 dark:text-sky-400" /> Check-in
                  opens 8:30 am and closes 11:30 am.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-royal-600 dark:text-sky-400" /> Arrive
                  by 9:30 am to be marked On time.
                </li>
                <li className="flex gap-2">
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-royal-600 dark:text-sky-400" /> Recorded by
                  checking in on your phone at the venue.
                </li>
              </ul>
            </article>
            <article className="rounded-(--radius-lg) border border-border bg-card p-6 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Thursday Prayer Meeting</h3>
                  <p className="mt-1 text-muted-foreground">Every Thursday at 8:30 pm</p>
                </div>
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-300">
                  <HandHeart aria-hidden className="size-5" />
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex gap-2">
                  <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700 dark:text-gold-300" /> Join in
                  person or online.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700 dark:text-gold-300" />{" "}
                  Attendance comes from the attendee list an admin uploads.
                </li>
                <li className="flex gap-2">
                  <CalendarCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700 dark:text-gold-300" />{" "}
                  Reminders the evening before and one hour before.
                </li>
              </ul>
            </article>
          </div>
        </section>

        {/* Venue */}
        <section id="venue" aria-labelledby="venue-title" className="scroll-mt-20 bg-surface-2 py-16">
          <div className="mx-auto grid max-w-[1280px] gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase dark:text-gold-300">
                Where
              </p>
              <h2 id="venue-title" className="text-3xl font-semibold">
                Our venue in Ikeja
              </h2>
              <address className="text-lg not-italic">
                7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos, Nigeria
              </address>
              <p className="text-muted-foreground">
                Check-in works within about 100 metres of the venue pin, so you can check in from the gate or the car
                park.
              </p>
              <Suspense fallback={<Skeleton className="h-11 w-40 rounded-full" />}>
                <DirectionsButton />
              </Suspense>
            </div>
            <div className="h-80 overflow-hidden rounded-(--radius-xl) border border-border shadow-lift sm:h-96">
              <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <VenueSection />
              </Suspense>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-16 sm:px-6"
        >
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase dark:text-gold-300">
              How it works
            </p>
            <h2 id="how-title" className="mt-2 text-3xl font-semibold">
              Three simple steps
            </h2>
          </div>
          <ol className="grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-(--radius-lg) border border-border bg-card p-6 shadow-soft">
                <span className="bg-grad-gold inline-flex size-12 items-center justify-center rounded-full text-navy-900">
                  <Icon aria-hidden className="size-6" />
                </span>
                <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Step {i + 1}</p>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-1.5 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Sign in */}
        <section aria-labelledby="signin-title" className="bg-grad-hero text-white">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
            <h2 id="signin-title" className="text-3xl font-semibold">
              Sign in to your area
            </h2>
            <p className="mt-2 text-white/80">Choose how you serve. Volunteers keep every member feature.</p>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {signIns.map(({ tab, label, text, icon: Icon }) => (
                <li key={tab}>
                  <Link
                    href={`/login?tab=${tab}`}
                    className="bg-grad-glass group flex h-full items-center gap-4 rounded-(--radius-lg) border border-white/15 p-5 backdrop-blur-md transition-transform hover:-translate-y-0.5"
                  >
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-300">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-xl font-semibold">{label} sign in</span>
                      <span className="block text-sm text-white/80">{text}</span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-5 shrink-0 text-gold-300 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-white/80">
              New to the unit?{" "}
              <Link href="/signup/member" className="font-semibold text-gold-300 underline-offset-4 hover:underline">
                Join as a member
              </Link>{" "}
              or{" "}
              <Link href="/signup/volunteer" className="font-semibold text-gold-300 underline-offset-4 hover:underline">
                volunteer
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Photo strip */}
        <section aria-label="Our unit at work" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <PhotoCard slot="volunteers-cleaning" title="Together" caption="Every Saturday" className="h-48 sm:h-60" />
            <PhotoCard slot="sparkling-floor" title="Excellence" caption="In every corner" className="h-48 sm:h-60" />
            <PhotoCard slot="team-aprons" title="One team" caption="Six teams, five zones" className="h-48 sm:h-60" />
            <PhotoCard slot="clean-lobby" title="Welcome" caption="Ready for worship" className="h-48 sm:h-60" />
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

async function currentVenue() {
  await connection();
  const venues = await repo().venues.list();
  return venues[0];
}

async function VenueSection() {
  const v = await currentVenue();
  return (
    <VenueMap lat={v.lat} lng={v.lng} name={v.name} address={v.address} radiusM={v.radiusM} className="h-full w-full" />
  );
}

async function DirectionsButton() {
  const v = await currentVenue();
  return (
    <Button asChild variant="default" size="lg">
      <a href={directionsUrl(v.lat, v.lng)} target="_blank" rel="noopener noreferrer">
        <Navigation aria-hidden /> Get directions<span className="sr-only"> (opens Google Maps in a new tab)</span>
      </a>
    </Button>
  );
}
