import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { DemoRibbon } from "@/components/layout/DemoRibbon";
import { isDemoMode } from "@/lib/env";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HOD Sanitation Hub",
    template: "%s · HOD Sanitation Hub",
  },
  description:
    "Attendance, duties and reporting for the Sanitation Unit of Household of David. Serving God with excellence, one clean space at a time.",
  applicationName: "HOD Sanitation Hub",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HOD Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a1a44" },
    { media: "(prefers-color-scheme: dark)", color: "#060f2b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-demo={isDemoMode() ? "true" : undefined}
      className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-gold-500 px-4 py-2 font-semibold text-navy-900 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
        <DemoRibbon />
      </body>
    </html>
  );
}
