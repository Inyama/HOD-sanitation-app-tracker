import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { now } from "@/lib/time/clock";
import { loadInbox } from "@/lib/member/inbox";

/**
 * POST /api/v1/me/data-export: everything we hold about me as a JSON download (spec 12,
 * Nigeria Data Protection Act 2023 and GDPR access rights). Secrets are never included.
 */
export async function POST() {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const u = auth.current.user;
  const r = repo();
  const [records, excuses, notifications, hours, duties, rsvps, titles, issues] = await Promise.all([
    r.records.list({ where: { userId: u.id } }),
    r.excuses.list({ where: { userId: u.id } }),
    r.notifications.list({ where: { userId: u.id } }),
    r.serviceHours.list({ where: { userId: u.id } }),
    r.duties.list({ where: { userId: u.id } }),
    r.rsvps.list({ where: { userId: u.id } }),
    r.userTitles.list({ where: { userId: u.id } }),
    r.issues.list({ where: { reporterId: u.id } }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, totpSecret, ...profile } = u;
  const exportData = {
    exportedAt: now().toISO(),
    about: "Your data held by HOD Sanitation Hub (Household of David, Sanitation Unit).",
    profile,
    titles: titles.map((t) => t.title),
    attendance: records.map((rec) => ({
      meetingId: rec.meetingId,
      status: rec.status,
      checkedInAt: rec.checkedInAt,
      method: rec.method,
      location:
        rec.lat !== null ? { lat: rec.lat, lng: rec.lng, accuracyM: rec.accuracyM, distanceM: rec.distanceM } : null,
      deviceId: rec.deviceId,
      flagged: rec.flagged,
      note: rec.note,
    })),
    excuses,
    notifications,
    messages: await loadInbox(u),
    serviceHours: hours,
    duties,
    rsvps,
    issueReports: issues,
  };
  await r.audit.append({
    actorId: u.id,
    action: "DATA_EXPORTED",
    entity: "User",
    entityId: u.id,
    before: null,
    after: null,
    ip: null,
  });
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-hod-data-${now().toISODate()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
