import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AttendanceRecord, User } from "@/lib/repo/types";
import { countedMeetings, tally, trailingAbsences } from "@/lib/attendance/aggregate";
import { attendancePercent, band, type BandKey } from "@/lib/attendance/percentage";
import { withRecurringMeetings } from "@/lib/time/schedule";
import { formatShort } from "@/lib/time/zone";
import type { AudiencePerson } from "./audience";
import type { RenderContext } from "./templates";
import { appUrl } from "./senders";

/**
 * Per-person facts for messages and reminders: percentage and band (spec 6.3, same functions as
 * every screen), teams, absent last Saturday, absences in a row. Built once per request.
 */

export interface PersonFacts {
  user: User;
  percent: number | null;
  bandKey: BandKey;
  bandLabel: string;
  teamIds: string[];
  absentLastSaturday: boolean;
  absencesInARow: number;
}

export async function loadPeopleFacts(repo: Repository, now: DateTime) {
  const [users, stored, records, teamMembers, teams, settings, venues] = await Promise.all([
    repo.users.list(),
    repo.meetings.list({ orderBy: { field: "startsAt" } }),
    repo.records.list(),
    repo.teamMembers.list(),
    repo.teams.list(),
    repo.settings.get(),
    repo.venues.list(),
  ]);
  const meetings = withRecurringMeetings(stored, now, 6);
  const byUser = new Map<string, AttendanceRecord[]>();
  for (const r of records) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r);
  const lastSaturday = meetings
    .filter((m) => m.type === "SATURDAY" && m.status !== "CANCELLED" && DateTime.fromISO(m.startsAt) <= now)
    .at(-1);
  const teamsOf = new Map<string, string[]>();
  for (const tm of teamMembers) teamsOf.set(tm.userId, [...(teamsOf.get(tm.userId) ?? []), tm.teamId]);

  const facts = new Map<string, PersonFacts>();
  for (const u of users) {
    const counted = countedMeetings(byUser.get(u.id) ?? [], meetings, { approvedAt: u.approvedAt, now });
    const percent = attendancePercent(tally(counted.map((c) => c.status)), settings.lateWeight);
    const b = band(percent, settings.bandThresholds);
    facts.set(u.id, {
      user: u,
      percent,
      bandKey: b.key,
      bandLabel: b.label,
      teamIds: teamsOf.get(u.id) ?? [],
      absentLastSaturday:
        !!lastSaturday &&
        (byUser.get(u.id) ?? []).some((r) => r.meetingId === lastSaturday.id && r.status === "ABSENT"),
      absencesInARow: trailingAbsences(counted),
    });
  }
  const next = meetings.find((m) => m.status !== "CANCELLED" && DateTime.fromISO(m.startsAt) > now);
  const venue = venues.find((v) => v.id === settings.venueId) ?? venues[0];
  return {
    facts,
    meetings,
    records,
    teams,
    settings,
    venueAddress: venue?.address ?? "",
    nextMeetingText: next ? `${next.title}, ${formatShort(next.startsAt)}` : "the next meeting",
    nextMeetingStartsAt: next?.startsAt ?? null,
  };
}

export type PeopleFacts = Awaited<ReturnType<typeof loadPeopleFacts>>;

export function audiencePeople(pf: PeopleFacts): AudiencePerson[] {
  return [...pf.facts.values()].map((f) => ({
    id: f.user.id,
    role: f.user.role,
    status: f.user.status,
    teamIds: f.teamIds,
    band: f.bandKey,
    absentLastSaturday: f.absentLastSaturday,
  }));
}

/** Merge-field context for one person (spec 8 fields). */
export function renderContextFor(pf: PeopleFacts, userId: string, extra: Partial<RenderContext> = {}): RenderContext {
  const f = pf.facts.get(userId)!;
  return {
    fullName: f.user.name,
    timezone: f.user.timezone,
    venueAddress: pf.venueAddress,
    checkinLink: `${appUrl()}/member/check-in`,
    percentage: f.percent,
    band: f.bandLabel,
    nextMeeting: pf.nextMeetingText,
    ...extra,
  };
}
