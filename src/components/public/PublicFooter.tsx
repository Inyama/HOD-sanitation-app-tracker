import Link from "next/link";
import { MapPin, Mail } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { photoCredits } from "@/components/brand/photos";
import { isDemoMode } from "@/lib/env";

/** Footer with address, privacy link and photo credits (spec 7.1). */
export function PublicFooter() {
  const credits = photoCredits();
  return (
    <footer className="bg-grad-sidebar text-white/85">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <Logo size={44} withWordmark onDark />
          <p className="max-w-xs text-sm text-white/75">Serving God with excellence, one clean space at a time.</p>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-heading text-base font-semibold text-white">Visit us</h2>
          <p className="flex items-start gap-2">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-300" />7 Surulere Industrial Road, Off
            Adeniyi Jones, Ikeja, Lagos, Nigeria
          </p>
          <p className="flex items-center gap-2">
            <Mail aria-hidden className="size-4 shrink-0 text-gold-300" />
            <a href="mailto:sanitation@hod-demo.example.com" className="underline-offset-4 hover:underline">
              sanitation@hod-demo.example.com
            </a>
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-heading text-base font-semibold text-white">More</h2>
          <ul className="space-y-1.5">
            <li>
              <Link href="/privacy" className="underline-offset-4 hover:underline">
                Privacy and location notice
              </Link>
            </li>
            <li>
              <Link href="/login" className="underline-offset-4 hover:underline">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/signup/member" className="underline-offset-4 hover:underline">
                Join the unit
              </Link>
            </li>
            {isDemoMode() && (
              <li className="pt-2 text-white/65">
                Build preview:{" "}
                <Link href="/design-system" className="underline">
                  design system
                </Link>
                ,{" "}
                <Link href="/dev/data" className="underline">
                  demo data
                </Link>
                ,{" "}
                <Link href="/dev/outbox" className="underline">
                  email outbox
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-2 px-4 py-4 text-xs text-white/65 sm:px-6">
          <p>© 2026 Household of David · Sanitation Unit</p>
          <p>
            {credits.length ? (
              <>
                Photos:{" "}
                {credits.map((c, i) => (
                  <span key={c.slot}>
                    {i > 0 && ", "}
                    <a href={c.sourceUrl!} className="underline" rel="noopener noreferrer" target="_blank">
                      {c.photographer}
                    </a>
                  </span>
                ))}
              </>
            ) : (
              "Imagery: original placeholder artwork. Photo credits appear here when photos are added."
            )}{" "}
            · Map data © OpenStreetMap contributors
          </p>
        </div>
      </div>
    </footer>
  );
}
