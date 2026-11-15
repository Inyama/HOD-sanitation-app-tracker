import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AttendanceRecord, AttendanceStatus, User } from "@/lib/repo/types";
import { ADMIN_LEVEL_LABELS, TITLE_LABELS } from "@/lib/repo/types";
import {
  attendanceViews,
  countedMeetings,
  currentStreak,
  isAtRisk,
  trailingAbsences,
} from "@/lib/attendance/aggregate";
import { evaluateCheckIn, checkInWindow, windowPhase, REJECTION_MESSAGES } from "@/lib/attendance/status";
import { nextMeeting } from "@/lib/time/schedule";
import { dueNotifications, reminderPlan, type SchedMeeting } from "@/lib/notifications/schedule";
import { LOCATION_PRESETS, simulatedReading } from "@/lib/demo/simulate";
import { DEMO_ACCOUNTS } from "@/data/seed/people";
import { formatShort } from "@/lib/time/zone";

/**
 * Data for the /dev/data review page (demo mode only). Everything is computed with the
 * same src/lib functions the app screens will use.
 */
export async function buildDemoSummary(repo: Repository, at: DateTime) {
  const [
    users,
    meetings,
    records,
    titles,
    uploads,
    uploadRows,
    excuses,
    issues,
    notifications,
    messages,
    duties,
    hours,
    userBadges,
    badges,
    announcements,
    settings,
    venues,
  ] = await Promise.all([
    repo.users.list(),
    repo.meetings.list({ orderBy: { field: "startsAt" } }),
    repo.records.list(),
    repo.userTitles.list(),
    repo.uploads.list(),
    repo.uploadRows.list(),
    repo.excuses.list(),
    repo.issues.list(),
    repo.notifications.list(),
    repo.messages.list(),
    repo.duties.list(),
    repo.serviceHours.list(),
    repo.userBadges.list(),
    repo.badges.list(),
    repo.announcements.list(),
    repo.settings.get(),
    repo.venues.list(),
  ]);
  const auditCount = await repo.audit.count();
  const venue = venues.find((v) => v.id === settings.venueId) ?? venues[0];

  const byUser = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId)!.push(r);
  }
  const tally = <T>(xs: T[], key: (x: T) => string) =>
    xs.reduce<Record<string, number>>((a, x) => {
      a[key(x)] = (a[key(x)] ?? 0) + 1;
      return a;
    }, {});

  const statusOrder: AttendanceStatus[] = ["ON_TIME", "LATE", "ABSENT", "EXCUSED"];
  const statusCounts = tally(records, (r) => r.status);
  const distribution = statusOrder.map((s) => ({
    status: s,
    count: statusCounts[s] ?? 0,
    pct: Math.round(((statusCounts[s] ?? 0) / Math.max(1, records.length)) * 1000) / 10,
  }));

  const viewFor = (u: User) =>
    attendanceViews(byUser.get(u.id) ?? [], meetings, {
      approvedAt: u.approvedAt,
      now: at,
      lateWeight: settings.lateWeight,
      thresholds: settings.bandThresholds,
    });

  const demoAccounts = DEMO_ACCOUNTS.map((d) => {
    const u = users.find((x) => x.email === d.email)!;
    const v = viewFor(u);
    const counted = countedMeetings(byUser.get(u.id) ?? [], meetings, { approvedAt: u.approvedAt, now: at });
    return {
      key: d.key,
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleDetail: u.adminLevel
        ? ADMIN_LEVEL_LABELS[u.adminLevel]
        : titles
            .filter((t) => t.userId === u.id)
            .map((t) => TITLE_LABELS[t.title])
            .join(", ") || null,
      status: u.status,
      isRemote: u.isRemote,
      target: d.target ?? "",
      percent: v.overall.percent,
      band: v.overall.band,
      onTimeRate: v.overall.onTimeRate,
      counts: v.overall.counts,
      views: {
        saturday: v.saturday.percent,
        thursday: v.thursday.percent,
        last3Months: v.last3Months.percent,
        yearToDate: v.yearToDate.percent,
      },
      counted: counted.length,
      streak: currentStreak(counted),
      badges: userBadges
        .filter((b) => b.userId === u.id)
        .map((b) => badges.find((x) => x.id === b.badgeId)?.name ?? b.badgeId),
      serviceHours: hours
        .filter((h) => h.userId === u.id && (h.source === "AUTO" || h.verifiedById))
        .reduce((s, h) => s + h.hours, 0),
      approvedAt: u.approvedAt,
    };
  });

  // Unit-wide numbers
  const active = users.filter((u) => u.status === "ACTIVE");
  const percents = active.map((u) => viewFor(u).overall.percent).filter((p): p is number => p !== null);
  const atRisk = active.filter((u) => {
    const counted = countedMeetings(byUser.get(u.id) ?? [], meetings, { approvedAt: u.approvedAt, now: at });
    return isAtRisk(
      viewFor(u).overall.percent,
      trailingAbsences(counted),
      settings.atRiskPercent,
      settings.atRiskConsecutiveAbsences,
    );
  }).length;

  // Live rules at the simulated instant
  const next = nextMeeting(meetings, at);
  const rules = {
    graceMinutes: settings.graceMinutes,
    openBeforeMinutes: next?.openBeforeMin ?? settings.openBeforeMinutes,
    closeAfterMinutes: next?.closeAfterMin ?? settings.closeAfterMinutes,
  };
  let nextInfo = null;
  if (next) {
    const start = DateTime.fromISO(next.startsAt, { zone: "utc" });
    const w = checkInWindow(start, rules);
    const geo = next.method !== "SHEET";
    nextInfo = {
      id: next.id,
      title: next.title,
      type: next.type,
      method: next.method,
      startsAt: next.startsAt,
      startsLabel: formatShort(next.startsAt),
      phase: geo ? windowPhase(at, start, rules) : null,
      opensLabel: geo ? formatShort(w.opensAt) : null,
      closesLabel: geo ? formatShort(w.closesAt) : null,
      checkIns: geo
        ? LOCATION_PRESETS.map((p) => {
            const reading = simulatedReading(p.id, venue);
            if (!reading)
              return {
                preset: p.label,
                ok: false,
                status: null,
                reason: "GPS_UNAVAILABLE",
                message: "No GPS fix. Ask a marshal for a manual check-in.",
                distanceM: null,
              };
            const r = evaluateCheckIn({
              nowUtc: at,
              meetingStartUtc: start,
              meetingCancelled: next.status === "CANCELLED",
              alreadyCheckedIn: false,
              rules,
              reading,
              venue,
              maxAccuracyM: settings.maxAccuracyM,
            });
            return r.ok
              ? {
                  preset: p.label,
                  ok: true,
                  status: r.status,
                  reason: null,
                  message: r.status === "ON_TIME" ? "On time" : "Late",
                  distanceM: Math.round(r.distanceM),
                }
              : {
                  preset: p.label,
                  ok: false,
                  status: null,
                  reason: r.reason,
                  message: REJECTION_MESSAGES[r.reason],
                  distanceM: r.distanceM !== undefined ? Math.round(r.distanceM) : null,
                };
          })
        : [],
    };
  }

  // Reminders due in the current minute, and the plan for the coming week
  const schedMeetings: (SchedMeeting & { title: string })[] = meetings.map((m) => ({
    ...m,
    checkedInUserIds: records
      .filter((r) => r.meetingId === m.id && (r.status === "ON_TIME" || r.status === "LATE"))
      .map((r) => r.userId),
    absentUnexcusedUserIds: records.filter((r) => r.meetingId === m.id && r.status === "ABSENT").map((r) => r.userId),
  }));
  // The rule preview lists everything due this minute; ones the scheduler already sent are counted separately.
  const sent = new Set(notifications.map((n) => n.dedupeKey.split(":").slice(0, 3).join(":")));
  const due = dueNotifications(at, schedMeetings, users, []);
  const dueByType = tally(due, (d) => d.type);
  const sentByType = tally(
    due.filter((d) => sent.has(d.key)),
    (d) => d.type,
  );
  const weekPlan = schedMeetings
    .flatMap((m) => reminderPlan(m).map((p) => ({ meeting: m.title, type: p.type, at: p.at, audience: p.audience })))
    .filter((p) => p.at >= at.startOf("minute") && p.at < at.plus({ days: 7 }))
    .sort((a, b) => a.at.toMillis() - b.at.toMillis())
    .map((p) => ({ ...p, at: p.at.toISO()!, atLabel: formatShort(p.at) }));

  const preview = uploads.find((u) => u.status === "PREVIEW");
  const previewRows = preview ? uploadRows.filter((r) => r.uploadId === preview.id) : [];

  return {
    at: at.toISO()!,
    atLabel: formatShort(at),
    venue: {
      name: venue.name,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      radiusM: venue.radiusM,
      verified: venue.verified,
    },
    totals: {
      people: users.length,
      byRole: tally(users, (u) => u.role),
      byStatus: tally(users, (u) => u.status),
      meetings: meetings.length,
      meetingsByStatus: tally(meetings, (m) => m.status),
      records: records.length,
      flagged: records.filter((r) => r.flagged).length,
      manual: records.filter((r) => r.method === "MANUAL").length,
      messages: messages.length,
      notifications: notifications.length,
      unreadNotifications: notifications.filter((n) => n.channel === "IN_APP" && !n.readAt).length,
      excuses: tally(excuses, (e) => e.status),
      issues: tally(issues, (i) => i.status),
      urgentOpenIssues: issues.filter((i) => i.status === "OPEN" && i.urgency === "URGENT").length,
      duties: duties.length,
      uploads: uploads.map((u) => ({
        id: u.id,
        name: u.originalName,
        status: u.status,
        rows: u.rowsTotal,
        matched: u.rowsMatched,
        exceptions: u.rowsException,
      })),
      audit: auditCount,
      announcements: announcements.length,
      pinned: announcements.filter((a) => a.pinned).length,
      badgesAwarded: userBadges.length,
    },
    unit: {
      averagePercent: percents.length
        ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10
        : null,
      atRisk,
      pendingApprovals: users.filter((u) => u.status === "PENDING").length,
    },
    distribution,
    demoAccounts,
    next: nextInfo,
    due: { total: due.length, byType: dueByType, sentByType },
    weekPlan,
    uploadPreview: preview
      ? {
          name: preview.originalName,
          rows: previewRows.length,
          byType: tally(previewRows, (r) => r.matchType),
          exceptions: previewRows
            .filter((r) => r.matchType !== "EMAIL")
            .map((r) => ({
              rawName: r.rawName,
              rawEmail: r.rawEmail,
              matchType: r.matchType,
              similarity: r.similarity,
              suggested: r.matchedUserId ? (users.find((u) => u.id === r.matchedUserId)?.name ?? null) : null,
            })),
        }
      : null,
  };
}

export type DemoSummary = Awaited<ReturnType<typeof buildDemoSummary>>;
