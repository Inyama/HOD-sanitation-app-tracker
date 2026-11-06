/** Prints a summary of the deterministic seed. Run: npx tsx scripts/seed-report.ts */
import { buildSeed, SEED_NOW } from "@/data/seed";
import { attendanceViews, countedMeetings, currentStreak } from "@/lib/attendance/aggregate";

const s = buildSeed();
const by = <T>(xs: T[], k: (x: T) => string) =>
  xs.reduce<Record<string, number>>((a, x) => ((a[k(x)] = (a[k(x)] ?? 0) + 1), a), {});
console.log(
  "people",
  s.users.length,
  by(s.users, (u) => u.role),
  by(s.users, (u) => u.status),
);
console.log(
  "meetings",
  s.meetings.length,
  by(s.meetings, (m) => `${m.type}:${m.status}`),
);
const st = by(s.records, (r) => r.status);
const total = s.records.length;
console.log(
  "records",
  total,
  Object.fromEntries(Object.entries(st).map(([k, v]) => [k, `${v} (${((v / total) * 100).toFixed(1)}%)`])),
);
console.log(
  "teams",
  s.teams.map((t) => `${t.name}:${s.teamMembers.filter((m) => m.teamId === t.id).length}`).join(" "),
);
console.log(
  "messages",
  s.messages.length,
  "recipients",
  s.messageRecipients.length,
  "notifications",
  s.notifications.length,
);
const perUser = by(s.notifications, (n) => n.userId);
console.log("notif per active user min/max", Math.min(...Object.values(perUser)), Math.max(...Object.values(perUser)));
console.log(
  "excuses",
  by(s.excuses, (e) => e.status),
  "issues",
  by(s.issues, (i) => `${i.status}:${i.urgency}`),
);
console.log(
  "duties",
  s.duties.length,
  "uploads",
  s.uploads.map((u) => `${u.id}:${u.status}:${u.rowsTotal}/${u.rowsMatched}/${u.rowsException}`),
);
console.log(
  "preview rows",
  by(
    s.uploadRows.filter((r) => r.uploadId === "upl-2026-11-05"),
    (r) => r.matchType,
  ),
);
console.log(
  "audit",
  s.auditLogs.length,
  "announcements",
  s.announcements.length,
  "pinned",
  s.announcements.filter((a) => a.pinned).length,
);
console.log(
  "flagged",
  s.records.filter((r) => r.flagged).map((r) => `${r.userId}:${r.method}:${r.flagReason}`),
);
for (const [key, id] of Object.entries(s.demo)) {
  const u = s.users.find((x) => x.id === id)!;
  const recs = s.records.filter((r) => r.userId === id);
  const v = attendanceViews(recs, s.meetings, { approvedAt: u.approvedAt, now: SEED_NOW });
  const counted = countedMeetings(recs, s.meetings, { approvedAt: u.approvedAt, now: SEED_NOW });
  const badges = s.userBadges.filter((b) => b.userId === id).map((b) => b.badgeId.replace("badge-", ""));
  const hrs = s.serviceHours.filter((h) => h.userId === id).reduce((a, h) => a + h.hours, 0);
  console.log(
    key.padEnd(8),
    String(v.overall.percent).padStart(5),
    v.overall.band.label.padEnd(16),
    JSON.stringify(v.overall.counts),
    "streak",
    currentStreak(counted),
    "badges",
    badges.join(","),
    "hours",
    hrs,
  );
}
