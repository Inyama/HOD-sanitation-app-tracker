import { DateTime } from "luxon";
import type { AttendanceStatus, IssueStatus, Role, UserStatus } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import {
  countedMeetings,
  currentStreak,
  isAtRisk,
  tally,
  trailingAbsences,
  type CountableMeeting,
  type CountedMeeting,
} from "@/lib/attendance/aggregate";
import {
  addCounts,
  attendancePercent,
  band,
  EMPTY_COUNTS,
  onTimeRate,
  totalCounted,
  type BandThresholds,
  type Counts,
} from "@/lib/attendance/percentage";
import type { DateRange } from "./range";

/**
 * Admin dashboard figures (spec 7.4). Pure: the loader passes plain rows in.
 *
 * - Attendance figures pool every counted person-meeting of active people in the period
 *   (spec 6.3 rules per person: approval date, cancelled meetings, excused out of the denominator).
 * - "Change versus previous period" compares with the period of the same kind just before
 *   (see range.ts). Head counts compare the count at the end of each period.
 */

export interface DashPerson {
  id: string;
  name: string;
  role: Role;
  status: UserStatus;
  approvedAt: string | null;
  createdAt: string;
  statusChangedAt: string | null;
  teamId: string | null;
}

export interface DashRecord {
  meetingId: string;
  userId: string;
  status: AttendanceStatus;
  checkedInAt: string | null;
}

export interface DashInput {
  now: DateTime;
  range: DateRange;
  people: DashPerson[];
  meetings: CountableMeeting[];
  records: DashRecord[];
  issues: { status: IssueStatus; createdAt: string }[];
  teams: { id: string; name: string }[];
  lateWeight: number;
  thresholds: BandThresholds;
  atRiskPercent: number;
  atRiskAbsences: number;
}

export interface Kpi {
  value: number | null;
  delta: number | null;
  trend?: number[];
}

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });
const round1 = (n: number) => Math.round(n * 10) / 10;
const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : round1(a - b));

/** Was this person an active member of the unit at instant t? */
export function activeAt(p: DashPerson, t: DateTime): boolean {
  if (!p.approvedAt || utc(p.approvedAt) > t) return false;
  if (p.status === "ACTIVE") return true;
  if ((p.status === "SUSPENDED" || p.status === "REMOVED") && p.statusChangedAt) return utc(p.statusChangedAt) > t;
  return false;
}

/** Waiting for approval at instant t (signed up, not yet approved, not turned away). */
export function pendingAt(p: DashPerson, t: DateTime): boolean {
  if (p.role === "ADMIN" || utc(p.createdAt) > t) return false;
  if (p.approvedAt && utc(p.approvedAt) <= t) return false;
  if (p.status === "PENDING") return true;
  return !!p.statusChangedAt && utc(p.statusChangedAt) > t && !p.approvedAt;
}

function countsBetween(
  counted: CountedMeeting[],
  from: DateTime,
  to: DateTime,
  type?: CountableMeeting["type"],
): Counts {
  return tally(
    counted
      .filter(
        (c) => (!type || c.meeting.type === type) && utc(c.meeting.startsAt) >= from && utc(c.meeting.startsAt) <= to,
      )
      .map((c) => c.status),
  );
}

export interface PersonStanding {
  id: string;
  name: string;
  role: Role;
  teamId: string | null;
  percent: number | null;
  onTimeRate: number | null;
  meetings: number;
  absencesInARow: number;
  streak: number;
}

export function buildDashboard(input: DashInput) {
  const { now, range, lateWeight } = input;
  const active = input.people.filter((p) => p.status === "ACTIVE");
  const recordsByUser = new Map<string, DashRecord[]>();
  for (const r of input.records) {
    const list = recordsByUser.get(r.userId);
    if (list) list.push(r);
    else recordsByUser.set(r.userId, [r]);
  }
  const counted = new Map<string, CountedMeeting[]>(
    active.map((p) => [
      p.id,
      countedMeetings(recordsByUser.get(p.id) ?? [], input.meetings, { approvedAt: p.approvedAt, now }),
    ]),
  );

  const pooled = (from: DateTime, to: DateTime, filter?: (p: DashPerson) => boolean, type?: CountableMeeting["type"]) =>
    active
      .filter((p) => !filter || filter(p))
      .reduce((acc, p) => addCounts(acc, countsBetween(counted.get(p.id) ?? [], from, to, type)), { ...EMPTY_COUNTS });

  // ---- 12-week trend, ending with the selected period ---------------------------------------
  const end = range.to.setZone(MEETING_ZONE).endOf("day");
  const weeklyTrend = Array.from({ length: 12 }, (_, i) => {
    const wFrom = end.minus({ weeks: 12 - i }).plus({ milliseconds: 1 });
    const wTo = end.minus({ weeks: 11 - i });
    const c = pooled(wFrom.toUTC(), wTo.toUTC());
    return {
      week: wFrom.toFormat("d LLL"),
      attendance: attendancePercent(c, lateWeight),
      onTime: onTimeRate(c),
    };
  });

  // ---- KPIs ----------------------------------------------------------------------------------
  const nonAdmin = (p: DashPerson) => p.role !== "ADMIN";
  const headCount = (t: DateTime, f: (p: DashPerson) => boolean) =>
    input.people.filter((p) => f(p) && activeAt(p, t)).length;
  const current = pooled(range.from, range.to);
  const previous = pooled(range.prevFrom, range.prevTo);
  const reportedIn = (from: DateTime, to: DateTime) =>
    input.issues.filter((i) => utc(i.createdAt) >= from && utc(i.createdAt) <= to).length;
  const pendingNow = input.people.filter((p) => p.status === "PENDING" && p.role !== "ADMIN").length;
  const trendValues = (k: "attendance" | "onTime") =>
    weeklyTrend.map((w) => w[k]).filter((v): v is number => v !== null);

  const kpis = {
    activeMembers: {
      value: active.filter(nonAdmin).length,
      delta: headCount(range.to, nonAdmin) - headCount(range.prevTo, nonAdmin),
    },
    volunteers: {
      value: active.filter((p) => p.role === "VOLUNTEER").length,
      delta:
        headCount(range.to, (p) => p.role === "VOLUNTEER") - headCount(range.prevTo, (p) => p.role === "VOLUNTEER"),
    },
    averageAttendance: {
      value: attendancePercent(current, lateWeight),
      delta: diff(attendancePercent(current, lateWeight), attendancePercent(previous, lateWeight)),
      trend: trendValues("attendance"),
    },
    onTimeRate: {
      value: onTimeRate(current),
      delta: diff(onTimeRate(current), onTimeRate(previous)),
      trend: trendValues("onTime"),
    },
    pendingApprovals: {
      value: pendingNow,
      delta:
        input.people.filter((p) => pendingAt(p, range.to)).length -
        input.people.filter((p) => pendingAt(p, range.prevTo)).length,
    },
    openIssues: {
      value: input.issues.filter((i) => i.status !== "RESOLVED").length,
      delta: reportedIn(range.from, range.to) - reportedIn(range.prevFrom, range.prevTo),
    },
  } satisfies Record<string, Kpi>;

  // ---- Saturday vs Thursday ------------------------------------------------------------------
  const spanDays = range.to.diff(range.from, "days").days;
  const buckets: { label: string; from: DateTime; to: DateTime }[] = [];
  if (spanDays <= 120) {
    let s = range.from.setZone(MEETING_ZONE).startOf("day");
    while (s <= range.to) {
      const e = DateTime.min(s.plus({ days: 7 }).minus({ milliseconds: 1 }), range.to.setZone(MEETING_ZONE));
      buckets.push({ label: s.toFormat("d LLL"), from: s.toUTC(), to: e.toUTC() });
      s = s.plus({ days: 7 });
    }
  } else {
    let s = range.from.setZone(MEETING_ZONE).startOf("month");
    while (s <= range.to) {
      const e = DateTime.min(s.endOf("month"), range.to.setZone(MEETING_ZONE));
      buckets.push({ label: s.toFormat("LLL yy"), from: DateTime.max(s, range.from).toUTC(), to: e.toUTC() });
      s = s.plus({ months: 1 });
    }
  }
  const saturdayVsThursday = buckets.map((b) => ({
    period: b.label,
    saturday: attendancePercent(pooled(b.from, b.to, undefined, "SATURDAY"), lateWeight),
    thursday: attendancePercent(pooled(b.from, b.to, undefined, "THURSDAY_PRAYER"), lateWeight),
  }));

  // ---- Attendance by team --------------------------------------------------------------------
  const byTeam = input.teams
    .map((t) => {
      const c = pooled(range.from, range.to, (p) => p.teamId === t.id);
      return {
        team: t.name,
        attendance: attendancePercent(c, lateWeight),
        people: active.filter((p) => p.teamId === t.id).length,
      };
    })
    .sort((a, b) => (b.attendance ?? -1) - (a.attendance ?? -1));

  // ---- Arrival heatmap: weekday by minutes from the start ------------------------------------
  const ARRIVAL_STEP = 15;
  const ARRIVAL_FROM = -60;
  const ARRIVAL_TO = 120;
  const columns: string[] = [];
  for (let m = ARRIVAL_FROM; m < ARRIVAL_TO; m += ARRIVAL_STEP)
    columns.push(m === 0 ? "0" : m > 0 ? `+${m}` : `−${-m}`);
  const meetingById = new Map(input.meetings.map((m) => [m.id, m]));
  const heatRows = (
    [
      ["SATURDAY", "Saturday"],
      ["THURSDAY_PRAYER", "Thursday"],
      ["SPECIAL", "Special events"],
    ] as const
  ).map(([type, label]) => ({ type, label, cells: columns.map(() => 0) }));
  const activeIds = new Set(active.map((p) => p.id));
  for (const r of input.records) {
    if (!r.checkedInAt || (r.status !== "ON_TIME" && r.status !== "LATE") || !activeIds.has(r.userId)) continue;
    const m = meetingById.get(r.meetingId);
    if (!m || m.status === "CANCELLED") continue;
    const start = utc(m.startsAt);
    if (start < range.from || start > range.to) continue;
    const minutes = utc(r.checkedInAt).diff(start, "minutes").minutes;
    if (minutes < ARRIVAL_FROM || minutes >= ARRIVAL_TO) continue;
    const row = heatRows.find((h) => h.type === m.type);
    if (row) row.cells[Math.floor((minutes - ARRIVAL_FROM) / ARRIVAL_STEP)]++;
  }
  const arrivals = {
    columns,
    rows: heatRows.filter((r) => r.cells.some((c) => c > 0)).map(({ label, cells }) => ({ label, cells })),
    max: Math.max(0, ...heatRows.flatMap((r) => r.cells)),
  };

  // ---- Standing lists (whole history, like the member screens) -------------------------------
  const standings: PersonStanding[] = active.filter(nonAdmin).map((p) => {
    const list = counted.get(p.id) ?? [];
    const c = tally(list.map((x) => x.status));
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      teamId: p.teamId,
      percent: attendancePercent(c, lateWeight),
      onTimeRate: onTimeRate(c),
      meetings: totalCounted(c),
      absencesInARow: trailingAbsences(list),
      streak: currentStreak(list),
    };
  });

  const atRisk = standings
    .filter((s) => isAtRisk(s.percent, s.absencesInARow, input.atRiskPercent, input.atRiskAbsences))
    .map((s) => ({
      ...s,
      reason:
        s.absencesInARow >= input.atRiskAbsences
          ? `${s.absencesInARow} absences in a row`
          : `Below ${input.atRiskPercent}%`,
      band: band(s.percent, input.thresholds),
    }))
    .sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101));

  const MIN_MEETINGS_FOR_TOP = 8;
  const topConsistent = standings
    .filter((s) => s.meetings >= MIN_MEETINGS_FOR_TOP && s.percent !== null)
    .sort(
      (a, b) =>
        b.percent! - a.percent! ||
        (b.onTimeRate ?? 0) - (a.onTimeRate ?? 0) ||
        b.streak - a.streak ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 10)
    .map((s) => ({ ...s, band: band(s.percent, input.thresholds) }));

  const newSignups = input.people
    .filter((p) => p.role !== "ADMIN" && utc(p.createdAt) >= range.from && utc(p.createdAt) <= range.to)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((p) => ({ id: p.id, name: p.name, role: p.role, status: p.status, createdAt: p.createdAt }));

  return {
    kpis,
    weeklyTrend,
    saturdayVsThursday,
    statusMix: current,
    byTeam,
    arrivals,
    atRisk,
    topConsistent,
    newSignups,
  };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
