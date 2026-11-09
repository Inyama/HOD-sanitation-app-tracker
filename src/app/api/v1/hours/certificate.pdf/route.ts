import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { renderCertificatePdf } from "@/lib/reports/pdf";
import { isVerified, verifiedHoursInYear } from "@/lib/volunteer/hours";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";
import { DateTime } from "luxon";
import { MEETING_ZONE } from "@/lib/time/zone";

/** GET /api/v1/hours/certificate.pdf?year=2026: yearly certificate of service with verified hours. */
export async function GET(req: NextRequest) {
  const auth = await apiUser("volunteer.hours");
  if (!auth.ok) return auth.res;
  const now = nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value);
  const year = Number(req.nextUrl.searchParams.get("year") ?? now.setZone(MEETING_ZONE).year);
  if (!Number.isInteger(year) || year < 2020 || year > now.year)
    return apiError("VALIDATION_FAILED", "Choose a year up to this one.", 422);
  const { user } = auth.current;
  const hours = await repo().serviceHours.list({ where: { userId: user.id } });
  const total = verifiedHoursInYear(hours, year);
  const meetings = new Set(
    hours
      .filter((h) => isVerified(h) && h.meetingId && DateTime.fromISO(h.createdAt).setZone(MEETING_ZONE).year === year)
      .map((h) => h.meetingId),
  ).size;
  const pdf = await renderCertificatePdf({
    name: user.name,
    year,
    hours: total,
    meetings,
    issuedOn: now.setZone(MEETING_ZONE).toFormat("d LLLL yyyy"),
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-of-service-${year}-${user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
