import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { TitleCode } from "@/lib/repo/types";
import {
  attendanceViews,
  countedMeetings,
  currentStreak,
  longestStreak,
  trailingAbsences,
} from "@/lib/attendance/aggregate";
import { heatCells } from "@/lib/attendance/heatmap";
import { withRecurringMeetings } from "@/lib/time/schedule";
import { buildDashboard } from "./dashboard";
import { resolveRange } from "./range";
import { canRestore, purgeDate, type MemberRow } from "./members";
import { actionLabel } from "./audit";

/** Read models for the admin screens, built only from the shared src/lib rules. */

export async function nameDirectory(repo: Repository): Promise<Map<string, string>> {
  const [users, meetings, teams] = await Promise.all([repo.users.list(), repo.meetings.list(), repo.teams.list()]);
  const names = new Map<string, string>();
  for (const u of users) names.set(u.id, u.name);
  for (const m of meetings)
    names.set(m.id, `${m.title}, ${DateTime.fromISO(m.startsAt).setZone("Africa/Lagos").toFormat("d LLL yyyy")}`);
  for (const t of teams) names.set(t.id, `${t.name} team`);
  return names;
}

export async function recentActivity(repo: Repository, limit = 8) {
  const [rows, names] = await Promise.all([
    repo.audit.list({ orderBy: { field: "createdAt", dir: "desc" }, limit }),
    nameDirectory(repo),
  ]);
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt,
    who: r.actorId ? (names.get(r.actorId) ?? "Someone") : "System",
    what: actionLabel(r.action),
    target: r.entityId ? (names.get(r.entityId) ?? null) : null,
  }));
}

export async function loadDashboard(repo: Repository, rangeValue: string | undefined, now: DateTime) {
  const range = resolveRange(rangeValue, now);
  const [users, stored, records, issues, teams, teamMembers, settings] = await Promise.all([
    repo.users.list(),
    repo.meetings.list({ orderBy: { field: "startsAt" } }),
    repo.records.list(),
    repo.issues.list(),
    repo.teams.list({ orderBy: { field: "name" } }),
    repo.teamMembers.list(),
    repo.settings.get(),
  ]);
  const teamOf = new Map(teamMembers.map((m) => [m.userId, m.teamId]));
  const meetings = withRecurringMeetings(stored, now, 4);
  const dash = buildDashboard({
    now,
    range,
    people: users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      status: u.status,
      approvedAt: u.approvedAt,
      createdAt: u.createdAt,
      statusChangedAt: u.statusChangedAt,
      teamId: teamOf.get(u.id) ?? null,
    })),
    meetings,
    records,
    issues,
    teams,
    lateWeight: settings.lateWeight,
    thresholds: settings.bandThresholds,
    atRiskPercent: settings.atRiskPercent,
    atRiskAbsences: settings.atRiskConsecutiveAbsences,
  });
  const upcoming = meetings
    .filter((m) => m.status !== "CANCELLED" && DateTime.fromISO(m.startsAt) >= now)
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      startsAt: m.startsAt,
      status: m.status,
      statusNote: m.statusNote,
    }));
  return {
    range: { key: range.key, value: range.value, label: range.label, fromDate: range.fromDate, toDate: range.toDate },
    ...dash,
    upcoming,
    activity: await recentActivity(repo),
    settings: { atRiskPercent: settings.atRiskPercent, atRiskAbsences: settings.atRiskConsecutiveAbsences },
  };
}
export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

export async function loadMemberRows(repo: Repository, now: DateTime): Promise<MemberRow[]> {
  const [users, stored, records, teams, teamMembers, titles, settings] = await Promise.all([
    repo.users.list(),
    repo.meetings.list(),
    repo.records.list(),
    repo.teams.list(),
    repo.teamMembers.list(),
    repo.userTitles.list(),
    repo.settings.get(),
  ]);
  const byUser = new Map<string, typeof records>();
  for (const r of records) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const teamOf = new Map(teamMembers.map((m) => [m.userId, m.teamId]));
  return users.map((u) => {
    const view = attendanceViews(byUser.get(u.id) ?? [], stored, {
      approvedAt: u.approvedAt,
      now,
      lateWeight: settings.lateWeight,
      thresholds: settings.bandThresholds,
    }).overall;
    const teamId = teamOf.get(u.id) ?? null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      adminLevel: u.adminLevel,
      status: u.status,
      isRemote: u.isRemote,
      city: u.city,
      country: u.country,
      teamId,
      teamName: teamId ? (teamName.get(teamId) ?? null) : null,
      titles: titles.filter((t) => t.userId === u.id).map((t) => t.title as TitleCode),
      percent: view.percent,
      bandKey: view.band.key,
      bandLabel: view.band.label,
      createdAt: u.createdAt,
      approvedAt: u.approvedAt,
      lastLoginAt: u.lastLoginAt,
      statusChangedAt: u.statusChangedAt,
      statusReason: u.statusReason,
      emailVerified: !!u.emailVerifiedAt,
      deletionRequestedAt: u.deletionRequestedAt,
    };
  });
}

export async function loadPendingPeople(repo: Repository) {
  const [pending, requested] = await Promise.all([
    repo.users.list({ where: { status: "PENDING" }, orderBy: { field: "createdAt", dir: "desc" } }),
    repo.users.list({ whereIn: { status: ["ACTIVE", "SUSPENDED"] } }),
  ]);
  return {
    pending: pending.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      city: u.city,
      country: u.country,
      language: u.language,
      isRemote: u.isRemote,
      createdAt: u.createdAt,
      emailVerified: !!u.emailVerifiedAt,
      consentLocation: !!u.consentLocationAt,
      consentReminders: !!u.consentRemindersAt,
      unitCode: u.signupDetails?.unitCode ?? null,
      zones: u.signupDetails?.zones ?? [],
      availability: u.signupDetails?.availability ?? [],
      notes: u.signupDetails?.notes ?? null,
    })),
    deletionRequests: requested
      .filter((u) => u.deletionRequestedAt)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, requestedAt: u.deletionRequestedAt! })),
  };
}

export async function loadProfile(repo: Repository, id: string, now: DateTime) {
  const user = await repo.users.get(id);
  if (!user) return null;
  const [
    stored,
    records,
    settings,
    titles,
    teamRow,
    teams,
    notes,
    excuses,
    recipients,
    messages,
    auditRows,
    names,
    hours,
    duties,
  ] = await Promise.all([
    repo.meetings.list({ orderBy: { field: "startsAt" } }),
    repo.records.list({ where: { userId: id } }),
    repo.settings.get(),
    repo.userTitles.list({ where: { userId: id } }),
    repo.teamMembers.findFirst({ userId: id }),
    repo.teams.list(),
    repo.memberNotes.list({ where: { userId: id }, orderBy: { field: "createdAt", dir: "desc" } }),
    repo.excuses.list({ where: { userId: id }, orderBy: { field: "createdAt", dir: "desc" } }),
    repo.messageRecipients.list({ where: { userId: id } }),
    repo.messages.list(),
    repo.audit.list({ where: { entityId: id }, orderBy: { field: "createdAt", dir: "desc" } }),
    nameDirectory(repo),
    repo.serviceHours.list({ where: { userId: id } }),
    repo.duties.list({ where: { userId: id } }),
  ]);
  const opts = {
    approvedAt: user.approvedAt,
    now,
    lateWeight: settings.lateWeight,
    thresholds: settings.bandThresholds,
  };
  const views = attendanceViews(records, stored, opts);
  const counted = countedMeetings(records, stored, { approvedAt: user.approvedAt, now });
  const meetingById = new Map(stored.map((m) => [m.id, m]));
  const recordByMeeting = new Map(records.map((r) => [r.meetingId, r]));
  const team = teamRow ? teams.find((t) => t.id === teamRow.teamId) : undefined;
  const messageById = new Map(messages.map((m) => [m.id, m]));
  const received = recipients
    .map((r) => ({ r, m: messageById.get(r.messageId) }))
    .filter((x) => x.m)
    .sort((a, b) => (b.m!.sentAt ?? "").localeCompare(a.m!.sentAt ?? ""))
    .slice(0, 12)
    .map(({ r, m }) => ({
      id: m!.id,
      subject: m!.subject,
      from: names.get(m!.senderId) ?? "Unit admin",
      sentAt: m!.sentAt,
      readAt: r.readAt,
    }));
  const timeline = [...counted]
    .reverse()
    .slice(0, 30)
    .map((c) => {
      const rec = recordByMeeting.get(c.meeting.id);
      return {
        meetingId: c.meeting.id,
        title: meetingById.get(c.meeting.id)?.title ?? "Meeting",
        type: c.meeting.type,
        startsAt: c.meeting.startsAt,
        status: c.status,
        checkedInAt: rec?.checkedInAt ?? null,
        method: rec?.method ?? null,
        flagged: rec?.flagged ?? false,
        note: rec?.note ?? null,
      };
    });
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      adminLevel: user.adminLevel,
      status: user.status,
      statusReason: user.statusReason,
      statusChangedAt: user.statusChangedAt,
      isRemote: user.isRemote,
      city: user.city,
      country: user.country,
      timezone: user.timezone,
      language: user.language,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      approvedAt: user.approvedAt,
      lastLoginAt: user.lastLoginAt,
      emailVerified: !!user.emailVerifiedAt,
      deletionRequestedAt: user.deletionRequestedAt,
      purgeOn: purgeDate(user)?.toISO() ?? null,
      canRestore: canRestore(user, now),
    },
    titles: titles.map((t) => t.title as TitleCode),
    team: team ? { id: team.id, name: team.name, isLead: team.leadUserId === user.id } : null,
    views,
    streak: currentStreak(counted),
    longestStreak: longestStreak(counted),
    absencesInARow: trailingAbsences(counted),
    heat: heatCells(stored, records, now, 6),
    timeline,
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt,
      author: names.get(n.authorId) ?? "Admin",
    })),
    excuses: excuses.map((e) => ({
      id: e.id,
      meeting: names.get(e.meetingId) ?? e.meetingId,
      reason: e.reason,
      status: e.status,
      createdAt: e.createdAt,
      reviewer: e.reviewedById ? (names.get(e.reviewedById) ?? null) : null,
      reviewNote: e.reviewNote,
    })),
    messages: received,
    audit: auditRows.slice(0, 20).map((a) => ({
      id: a.id,
      at: a.createdAt,
      who: a.actorId ? (names.get(a.actorId) ?? "Someone") : "System",
      what: actionLabel(a.action),
      action: a.action,
      ip: a.ip,
    })),
    hours: {
      total:
        Math.round(hours.filter((h) => h.verifiedById || h.source === "AUTO").reduce((s, h) => s + h.hours, 0) * 10) /
        10,
      duties: duties.length,
    },
  };
}
export type ProfileData = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;
