import { DateTime } from "luxon";
import type { AttendanceRecord, MeetingType, ServiceHour } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import { countedMeetings, tally, type CountableMeeting, type CountedMeeting } from "@/lib/attendance/aggregate";
import { attendancePercent, onTimeRate } from "@/lib/attendance/percentage";
import type { DashPerson } from "./dashboard";
import type { DateRange } from "./range";

/**
 * Performance analytics (spec 7.4 item 9): cohorts by sign-up month, punctuality trend,
 * drop-off, team leaderboards. Pure; filters by meeting type and team.
 */

export interface AnalyticsInput {
  now: DateTime;
  range: Pick<DateRange, "from" | "to" | "prevFrom" | "prevTo">;
  people: (DashPerson & { isRemote: boolean })[];
  meetings: CountableMeeting[];
  records: Pick<AttendanceRecord, "meetingId" | "userId" | "status" | "checkedInAt">[];
  hours: Pick<ServiceHour, "userId" | "hours" | "source" | "verifiedById" | "createdAt">[];
  teams: { id: string; name: string }[];
  lateWeight: number;
  meetingType: "ALL" | MeetingType;
  teamId: string;
}

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildAnalytics(input: AnalyticsInput) {
  const { now, range, lateWeight } = input;
  const meetings = input.meetings.filter((m) => input.meetingType === "ALL" || m.type === input.meetingType);
  const people = input.people.filter(
    (p) => p.role !== "ADMIN" && p.approvedAt && (input.teamId === "ALL" || p.teamId === input.teamId),
  );
  const recs = new Map<string, AnalyticsInput["records"]>();
  for (const r of input.records) (recs.get(r.userId) ?? recs.set(r.userId, []).get(r.userId)!).push(r);
  const counted = new Map<string, CountedMeeting[]>(
    people.map((p) => [p.id, countedMeetings(recs.get(p.id) ?? [], meetings, { approvedAt: p.approvedAt, now })]),
  );
  const between = (list: CountedMeeting[], from: DateTime, to: DateTime) =>
    list.filter((c) => utc(c.meeting.startsAt) >= from && utc(c.meeting.startsAt) <= to);
  const pctOf = (list: CountedMeeting[]) => attendancePercent(tally(list.map((c) => c.status)), lateWeight);

  // ---- Cohorts by approval month (last 12 months) ---------------------------------------------
  const cohortStart = now.setZone(MEETING_ZONE).startOf("month").minus({ months: 11 });
  const cohortMap = new Map<string, typeof people>();
  for (const p of people) {
    const m = utc(p.approvedAt!).setZone(MEETING_ZONE);
    if (m < cohortStart) continue;
    const key = m.toFormat("yyyy-LL");
    cohortMap.set(key, [...(cohortMap.get(key) ?? []), p]);
  }
  const cohorts = [...cohortMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, members]) => {
      const first = members.flatMap((p) => {
        const a = utc(p.approvedAt!);
        return between(counted.get(p.id) ?? [], a, a.plus({ days: 90 }));
      });
      const all = members.flatMap((p) => counted.get(p.id) ?? []);
      return {
        cohort: DateTime.fromFormat(key, "yyyy-LL", { zone: MEETING_ZONE }).toFormat("LLL yyyy"),
        size: members.length,
        firstThreeMonths: pctOf(first),
        overall: pctOf(all),
        stillActive: members.filter((p) => p.status === "ACTIVE").length,
      };
    });

  // ---- Punctuality: on-time rate and average arrival, per week (or month for long ranges) --------
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const peopleIds = new Set(people.map((p) => p.id));
  const spanDays = range.to.diff(range.from, "days").days;
  const buckets: { label: string; from: DateTime; to: DateTime }[] = [];
  let s = range.from.setZone(MEETING_ZONE).startOf(spanDays > 190 ? "month" : "day");
  while (s <= range.to) {
    const e = spanDays > 190 ? s.endOf("month") : s.plus({ days: 7 }).minus({ milliseconds: 1 });
    buckets.push({ label: s.toFormat(spanDays > 190 ? "LLL yy" : "d LLL"), from: s.toUTC(), to: e.toUTC() });
    s = spanDays > 190 ? s.plus({ months: 1 }) : s.plus({ days: 7 });
  }
  const punctuality = buckets.map((b) => {
    const arrivals = input.records.filter((r) => {
      const m = meetingById.get(r.meetingId);
      return (
        m &&
        peopleIds.has(r.userId) &&
        m.status !== "CANCELLED" &&
        (r.status === "ON_TIME" || r.status === "LATE") &&
        utc(m.startsAt) >= b.from &&
        utc(m.startsAt) <= b.to
      );
    });
    const timed = arrivals.filter((r) => r.checkedInAt);
    const avg = timed.length
      ? round1(
          timed.reduce(
            (sum, r) => sum + utc(r.checkedInAt!).diff(utc(meetingById.get(r.meetingId)!.startsAt), "minutes").minutes,
            0,
          ) / timed.length,
        )
      : null;
    return {
      period: b.label,
      onTime: onTimeRate(tally(arrivals.map((r) => r.status))),
      averageArrival: avg,
    };
  });

  // ---- Drop-off: recent month against the three months before it ------------------------------
  const recentFrom = range.to.minus({ days: 30 });
  const beforeFrom = recentFrom.minus({ days: 90 });
  const dropping = people
    .filter((p) => p.status === "ACTIVE")
    .map((p) => {
      const list = counted.get(p.id) ?? [];
      const before = pctOf(between(list, beforeFrom, recentFrom));
      const recent = pctOf(between(list, recentFrom, range.to));
      return {
        id: p.id,
        name: p.name,
        before,
        recent,
        change: before !== null && recent !== null ? round1(recent - before) : null,
      };
    })
    .filter((x) => x.change !== null && x.change <= -20)
    .sort((a, b) => a.change! - b.change!);

  // How many of the last four Saturdays each in-person member attended.
  const lastSaturdays = input.meetings
    .filter(
      (m) => m.type === "SATURDAY" && m.status !== "CANCELLED" && utc(m.startsAt) <= range.to && utc(m.startsAt) <= now,
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 4);
  const satIds = new Set(lastSaturdays.map((m) => m.id));
  const distribution = [0, 1, 2, 3, 4].map((n) => ({ attended: `${n} of ${lastSaturdays.length}`, people: 0 }));
  for (const p of people.filter((x) => x.status === "ACTIVE" && !x.isRemote)) {
    const n = (recs.get(p.id) ?? []).filter(
      (r) => satIds.has(r.meetingId) && (r.status === "ON_TIME" || r.status === "LATE"),
    ).length;
    if (distribution[n]) distribution[n].people++;
  }

  // ---- Team leaderboard ------------------------------------------------------------------------
  const inRange = (iso: string, from: DateTime, to: DateTime) => utc(iso) >= from && utc(iso) <= to;
  const leaderboard = input.teams
    .filter((t) => input.teamId === "ALL" || t.id === input.teamId)
    .map((t) => {
      const members = people.filter((p) => p.teamId === t.id && p.status === "ACTIVE");
      const cur = members.flatMap((p) => between(counted.get(p.id) ?? [], range.from, range.to));
      const prev = members.flatMap((p) => between(counted.get(p.id) ?? [], range.prevFrom, range.prevTo));
      const attendance = pctOf(cur);
      const before = pctOf(prev);
      const ids = new Set(members.map((m) => m.id));
      const hours = input.hours
        .filter(
          (h) =>
            ids.has(h.userId) && (h.source === "AUTO" || h.verifiedById) && inRange(h.createdAt, range.from, range.to),
        )
        .reduce((sum, h) => sum + h.hours, 0);
      return {
        team: t.name,
        people: members.length,
        attendance,
        change: attendance !== null && before !== null ? round1(attendance - before) : null,
        onTime: onTimeRate(tally(cur.map((c) => c.status))),
        hours: round1(hours),
      };
    })
    .sort((a, b) => (b.attendance ?? -1) - (a.attendance ?? -1));

  return { cohorts, punctuality, dropping, distribution, leaderboard, lastSaturdays: lastSaturdays.length };
}

export type Analytics = ReturnType<typeof buildAnalytics>;
