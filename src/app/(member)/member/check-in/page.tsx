import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/session";
import { serverNow } from "@/lib/time/server-now";
import { loadMemberData, publicMeeting } from "@/lib/member/data";
import { isDemoMode } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { CheckInPanel } from "@/components/attendance/CheckInPanel";

export const metadata: Metadata = { title: "Check in" };

export default async function CheckInPage({ searchParams }: PageProps<"/member/check-in">) {
  const { user } = await requirePage("/member/check-in");
  const now = await serverNow();
  const d = await loadMemberData(user, now);
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.slice(0, 6).toUpperCase() : undefined;
  const rec = d.nextGeoRecord;
  return (
    <>
      <PageHeader
        title="Check in"
        subtitle="Confirm you are at the venue. Your location is read once, only when you ask."
      />
      <CheckInPanel
        meeting={d.nextGeo ? publicMeeting(d.nextGeo) : null}
        venue={{
          name: d.venue.name,
          address: d.venue.address,
          lat: d.venue.lat,
          lng: d.venue.lng,
          radiusM: d.nextGeo?.radiusM ?? d.venue.radiusM,
        }}
        maxAccuracyM={d.settings.maxAccuracyM}
        existing={rec ? { status: rec.status, checkedInAt: rec.checkedInAt } : null}
        percent={d.views.overall.percent}
        isRemote={user.isRemote}
        demo={isDemoMode()}
        initialCode={code}
      />
    </>
  );
}
