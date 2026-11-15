import { DateTime } from "luxon";
import type {
  AttendanceRecord,
  AttendanceStatus,
  DutyAssignment,
  ExcuseRequest,
  IssueStatus,
  Meeting,
  MeetingType,
  Role,
  ServiceHour,
  UserStatus,
} from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import { countedMeetings, tally, trailingAbsences } from "@/lib/attendance/aggregate";
import { attendancePercent, band, onTimeRate, totalCounted, type BandThresholds } from "@/lib/attendance/percentage";
import { buildDashboard } from "@/lib/admin/dashboard";
import type { DateRange } from "@/lib/admin/range";

/**
 * Admin reports (spec 7.4 item 8). Pure builders: every report is a title, summary figures and
 * one or more tables, generated from the live records. CSV, XLSX and PDF render the same shape.
 */

export type ReportType = "REGISTER" | "MEMBER_SUMMARY" | "LATE" | "ABSENTEES" | "HOURS" | "LEADERSHIP";
export type ReportFormat = "csv" | "xlsx" | "pdf";

export const REPORT_TYPES: { key: ReportType; label: string; description: string }[] = [
  { key: "REGISTER", label: "Attendance register", description: "Everyone against every meeting: P, L, A or E." },
  { key: "MEMBER_SUMMARY", label: "Member summary", description: "Counts and percentage for each person." },
  { key: "LATE", label: "Late arrivals", description: "Every Late check-in with how late it was." },
  { key: "ABSENTEES", label: "Absentees", description: "Every absence, with excuse status and absences in a row." },
  { key: "HOURS", label: "Volunteer hours", description: "Verified and pending service hours and duties." },
  { key: "LEADERSHIP", label: "Leadership one-pager", description: "Key figures, teams, at-risk and most consistent." },
];

export const REPORT_LABEL = Object.fromEntries(REPORT_TYPES.map((r) => [r.key, r.label])) as Record<ReportType, string>;

export interface ReportFilters {
  meetingType: "ALL" | MeetingType;
  teamId: string;
  userId: string | null;
}

export interface ReportPerson {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  approvedAt: string | null;
  createdAt: string;
  statusChangedAt: string | null;
  teamId: string | null;
  isRemote: boolean;
}

export interface ReportData {
  now: DateTime;
  range: Pick<DateRange, "from" | "to" | "label" | "prevFrom" | "prevTo" | "key" | "value" | "fromDate" | "toDate">;
  people: ReportPerson[];
  meetings: Meeting[];
  records: AttendanceRecord[];
  excuses: ExcuseRequest[];
  hours: ServiceHour[];
  duties: DutyAssignment[];
  issues: { status: IssueStatus; createdAt: string }[];
  teams: { id: string; name: string }[];
  lateWeight: number;
  thresholds: BandThresholds;
  atRiskPercent: number;
  atRiskAbsences: number;
}

export type Cell = string | number | null;

export interface ReportColumn {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  /** Relative width for PDF and XLSX. */
  width?: number;
}

export interface ReportTable {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, Cell>[];
  note?: string;
  /** Columns the PDF keeps when the table is too wide for a page (all when missing). */
  pdfColumns?: string[];
}

export interface Report {
  type: ReportType;
  title: string;
  period: string;
  filters: string[];
  generatedAt: string;
  summary: [string, string][];
  tables: ReportTable[];
  landscape: boolean;
  fileBase: string;
}

const STATUS_CODE: Record<AttendanceStatus, string> = { ON_TIME: "P", LATE: "L", ABSENT: "A", EXCUSED: "E" };
const STATUS_WORD: Record<AttendanceStatus, string> = {
  ON_TIME: "On time",
  LATE: "Late",
  ABSENT: "Absent",
  EXCUSED: "Excused",
};
const TYPE_LABEL: Record<MeetingType, string> = {
  SATURDAY: "Saturday",
  THURSDAY_PRAYER: "Thursday prayer",
  SPECIAL: "Special",
};

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });
const lagos = (iso: string) => utc(iso).setZone(MEETING_ZONE);
const day = (iso: string) => lagos(iso).toFormat("ccc d LLL yyyy");
const clock = (iso: string | null) => (iso ? lagos(iso).toFormat("h:mm a").toLowerCase() : "");
const pct = (n: number | null) => (n === null ? "–" : `${n}%`);
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Meetings in scope: held (not in the future), not cancelled, in the period, of the chosen type. */
export function scopedMeetings(data: ReportData, filters: ReportFilters): Meeting[] {
  return data.meetings
    .filter((m) => m.status !== "CANCELLED")
    .filter((m) => filters.meetingType === "ALL" || m.type === filters.meetingType)
    .filter((m) => {
      const s = utc(m.startsAt);
      return s >= data.range.from && s <= data.range.to && s <= data.now;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** People in scope: approved, not removed, matching the team or person filter. */
export function scopedPeople(data: ReportData, filters: ReportFilters): ReportPerson[] {
  return data.people
    .filter((p) => p.approvedAt && p.status !== "REMOVED" && p.status !== "PENDING")
    .filter((p) => filters.teamId === "ALL" || p.teamId === filters.teamId)
    .filter((p) => !filters.userId || p.id === filters.userId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildReport(type: ReportType, data: ReportData, filters: ReportFilters): Report {
  const teamName = new Map(data.teams.map((t) => [t.id, t.name]));
  const meetings = scopedMeetings(data, filters);
  const people = scopedPeople(data, filters);
  const recordsBy = new Map<string, AttendanceRecord[]>();
  for (const r of data.records) (recordsBy.get(r.userId) ?? recordsBy.set(r.userId, []).get(r.userId)!).push(r);
  const countedFor = (p: ReportPerson) =>
    countedMeetings(recordsBy.get(p.id) ?? [], meetings, { approvedAt: p.approvedAt, now: data.now });
  const meetingIds = new Set(meetings.map((m) => m.id));
  const meetingById = new Map(data.meetings.map((m) => [m.id, m]));
  const team = (p: ReportPerson) => (p.teamId ? (teamName.get(p.teamId) ?? "") : "");

  const filterText: string[] = [];
  if (filters.meetingType !== "ALL") filterText.push(`Meetings: ${TYPE_LABEL[filters.meetingType]} only`);
  if (filters.teamId !== "ALL") filterText.push(`Team: ${teamName.get(filters.teamId) ?? filters.teamId}`);
  if (filters.userId)
    filterText.push(`Person: ${data.people.find((p) => p.id === filters.userId)?.name ?? filters.userId}`);

  const base = {
    type,
    title: REPORT_LABEL[type],
    period: `${data.range.label} (${lagos(data.range.from.toISO()!).toFormat("d LLL yyyy")} to ${lagos(data.range.to.toISO()!).toFormat("d LLL yyyy")})`,
    filters: filterText,
    generatedAt: lagos(data.now.toISO()!).toFormat("ccc d LLL yyyy, HH:mm"),
    landscape: false,
    fileBase: `hod-${slug(REPORT_LABEL[type])}-${data.range.fromDate}-to-${data.range.toDate}`,
  };

  // Pooled counts for the summary line most reports share.
  const pooled = people.reduce(
    (acc, p) => {
      const c = tally(countedFor(p).map((x) => x.status));
      acc.onTime += c.onTime;
      acc.late += c.late;
      acc.absent += c.absent;
      acc.excused += c.excused;
      return acc;
    },
    { onTime: 0, late: 0, absent: 0, excused: 0 },
  );
  const common: [string, string][] = [
    ["Meetings held", String(meetings.length)],
    ["People", String(people.length)],
    ["Attendance", pct(attendancePercent(pooled, data.lateWeight))],
    ["On-time rate", pct(onTimeRate(pooled))],
  ];

  switch (type) {
    case "REGISTER": {
      const MAX_PDF_COLUMNS = 26;
      const columns: ReportColumn[] = [
        { key: "name", header: "Name", width: 3 },
        { key: "team", header: "Team", width: 2 },
        ...meetings.map((m) => ({
          key: m.id,
          header: lagos(m.startsAt).toFormat(
            m.type === "SATURDAY" ? "'Sat' d/L" : m.type === "THURSDAY_PRAYER" ? "'Thu' d/L" : "'Evt' d/L",
          ),
          align: "center" as const,
          width: 1,
        })),
        { key: "attended", header: "Attended", align: "right", width: 1.4 },
        { key: "counted", header: "Counted", align: "right", width: 1.4 },
        { key: "percent", header: "%", align: "right", width: 1.2 },
      ];
      const rows = people.map((p) => {
        const counted = countedFor(p);
        const byMeeting = new Map(counted.map((c) => [c.meeting.id, c.status]));
        const c = tally(counted.map((x) => x.status));
        const row: Record<string, Cell> = { name: p.name, team: team(p) };
        for (const m of meetings) row[m.id] = byMeeting.has(m.id) ? STATUS_CODE[byMeeting.get(m.id)!] : "–";
        row.attended = c.onTime + c.late;
        row.counted = totalCounted(c);
        row.percent = pct(attendancePercent(c, data.lateWeight));
        return row;
      });
      return {
        ...base,
        landscape: true,
        summary: [...common, ["Key", "P On time · L Late · A Absent · E Excused · – not counted"]],
        tables: [
          {
            title: "Register",
            columns,
            rows,
            note:
              meetings.length > MAX_PDF_COLUMNS
                ? `${meetings.length} meetings: the PDF shows totals only; open the XLSX for every meeting.`
                : undefined,
            pdfColumns:
              meetings.length > MAX_PDF_COLUMNS ? ["name", "team", "attended", "counted", "percent"] : undefined,
          },
        ],
      };
    }

    case "MEMBER_SUMMARY": {
      const rows = people.map((p) => {
        const c = tally(countedFor(p).map((x) => x.status));
        const percent = attendancePercent(c, data.lateWeight);
        return {
          name: p.name,
          email: p.email,
          team: team(p),
          role: p.role === "VOLUNTEER" ? "Volunteer" : p.role === "ADMIN" ? "Admin" : "Member",
          counted: totalCounted(c),
          onTime: c.onTime,
          late: c.late,
          absent: c.absent,
          excused: c.excused,
          percent: pct(percent),
          onTimeRate: pct(onTimeRate(c)),
          band: band(percent, data.thresholds).label,
        };
      });
      return {
        ...base,
        landscape: true,
        summary: common,
        tables: [
          {
            title: "Members",
            columns: [
              { key: "name", header: "Name", width: 3 },
              { key: "email", header: "Email", width: 4 },
              { key: "team", header: "Team", width: 2 },
              { key: "role", header: "Role", width: 1.6 },
              { key: "counted", header: "Counted", align: "right", width: 1.3 },
              { key: "onTime", header: "On time", align: "right", width: 1.3 },
              { key: "late", header: "Late", align: "right", width: 1 },
              { key: "absent", header: "Absent", align: "right", width: 1.2 },
              { key: "excused", header: "Excused", align: "right", width: 1.3 },
              { key: "percent", header: "Attendance", align: "right", width: 1.6 },
              { key: "onTimeRate", header: "On-time rate", align: "right", width: 1.7 },
              { key: "band", header: "Band", width: 2.2 },
            ],
            rows,
          },
        ],
      };
    }

    case "LATE": {
      const rows: Record<string, Cell>[] = [];
      const latePeople = new Set<string>();
      let minutes = 0;
      for (const p of people)
        for (const c of countedFor(p)) {
          if (c.status !== "LATE") continue;
          const rec = (recordsBy.get(p.id) ?? []).find((r) => r.meetingId === c.meeting.id)!;
          const m = meetingById.get(c.meeting.id)!;
          const late = rec.checkedInAt
            ? Math.max(0, Math.round(utc(rec.checkedInAt).diff(utc(m.startsAt), "minutes").minutes))
            : null;
          if (late !== null) minutes += late;
          latePeople.add(p.id);
          rows.push({
            date: day(m.startsAt),
            sort: m.startsAt,
            meeting: m.title,
            name: p.name,
            team: team(p),
            arrived: clock(rec.checkedInAt),
            minutesLate: late,
            method: rec.method === "GEO" ? "Phone" : rec.method === "SHEET" ? "Sheet" : "Manual",
          });
        }
      rows.sort((a, b) => String(b.sort).localeCompare(String(a.sort)) || String(a.name).localeCompare(String(b.name)));
      rows.forEach((r) => delete r.sort);
      const timed = rows.filter((r) => r.minutesLate !== null).length;
      return {
        ...base,
        summary: [
          ["Late arrivals", String(rows.length)],
          ["People who were late", String(latePeople.size)],
          ["Average minutes late", timed ? String(Math.round(minutes / timed)) : "–"],
          ...common.slice(0, 1),
        ],
        tables: [
          {
            title: "Late arrivals",
            columns: [
              { key: "date", header: "Date", width: 2.4 },
              { key: "meeting", header: "Meeting", width: 3.2 },
              { key: "name", header: "Name", width: 3 },
              { key: "team", header: "Team", width: 2 },
              { key: "arrived", header: "Arrived", align: "right", width: 1.4 },
              { key: "minutesLate", header: "Minutes late", align: "right", width: 1.6 },
              { key: "method", header: "Method", width: 1.4 },
            ],
            rows,
          },
        ],
      };
    }

    case "ABSENTEES": {
      const rows: Record<string, Cell>[] = [];
      const absentPeople = new Set<string>();
      for (const p of people) {
        const allCounted = countedMeetings(recordsBy.get(p.id) ?? [], data.meetings, {
          approvedAt: p.approvedAt,
          now: data.now,
        });
        const inARow = trailingAbsences(allCounted);
        for (const c of countedFor(p)) {
          if (c.status !== "ABSENT") continue;
          const m = meetingById.get(c.meeting.id)!;
          const excuse = data.excuses.find((e) => e.userId === p.id && e.meetingId === m.id);
          absentPeople.add(p.id);
          rows.push({
            date: day(m.startsAt),
            sort: m.startsAt,
            meeting: m.title,
            name: p.name,
            team: team(p),
            phone: p.phone ?? "",
            excuse: excuse
              ? excuse.status === "PENDING"
                ? "Waiting"
                : excuse.status === "DECLINED"
                  ? "Declined"
                  : "Approved"
              : "None",
            inARow,
          });
        }
      }
      rows.sort((a, b) => String(b.sort).localeCompare(String(a.sort)) || String(a.name).localeCompare(String(b.name)));
      rows.forEach((r) => delete r.sort);
      return {
        ...base,
        summary: [
          ["Absences", String(rows.length)],
          ["People absent at least once", String(absentPeople.size)],
          [
            "Absent now 3+ in a row",
            String(new Set(rows.filter((r) => Number(r.inARow) >= 3).map((r) => r.name)).size),
          ],
          ...common.slice(0, 1),
        ],
        tables: [
          {
            title: "Absences",
            columns: [
              { key: "date", header: "Date", width: 2.4 },
              { key: "meeting", header: "Meeting", width: 3.2 },
              { key: "name", header: "Name", width: 3 },
              { key: "team", header: "Team", width: 2 },
              { key: "phone", header: "Phone", width: 2.4 },
              { key: "excuse", header: "Excuse", width: 1.5 },
              { key: "inARow", header: "Absent in a row now", align: "right", width: 1.8 },
            ],
            rows,
          },
        ],
      };
    }

    case "HOURS": {
      const inRange = (iso: string) => utc(iso) >= data.range.from && utc(iso) <= data.range.to;
      const vols = people.filter(
        (p) => p.role === "VOLUNTEER" || data.hours.some((h) => h.userId === p.id && inRange(h.createdAt)),
      );
      const rows = vols.map((p) => {
        const mine = data.hours.filter((h) => h.userId === p.id && inRange(h.createdAt));
        const verified = mine.filter((h) => h.source === "AUTO" || h.verifiedById).reduce((s, h) => s + h.hours, 0);
        const pending = mine.filter((h) => h.source === "MANUAL" && !h.verifiedById).reduce((s, h) => s + h.hours, 0);
        const duties = data.duties.filter(
          (d) => d.userId === p.id && meetingIds.has(d.meetingId) && d.status !== "SWAPPED",
        );
        const last = duties
          .map((d) => meetingById.get(d.meetingId)!.startsAt)
          .sort()
          .at(-1);
        return {
          name: p.name,
          team: team(p),
          verified: Math.round(verified * 10) / 10,
          pending: Math.round(pending * 10) / 10,
          duties: duties.length,
          lastDuty: last ? day(last) : "",
        };
      });
      rows.sort((a, b) => b.verified - a.verified || a.name.localeCompare(b.name));
      const totalV = rows.reduce((s, r) => s + r.verified, 0);
      return {
        ...base,
        summary: [
          ["Volunteers", String(rows.length)],
          ["Verified hours", String(Math.round(totalV * 10) / 10)],
          ["Hours waiting for verification", String(Math.round(rows.reduce((s, r) => s + r.pending, 0) * 10) / 10)],
          ["Duties served", String(rows.reduce((s, r) => s + r.duties, 0))],
        ],
        tables: [
          {
            title: "Volunteer hours",
            columns: [
              { key: "name", header: "Name", width: 3 },
              { key: "team", header: "Team", width: 2 },
              { key: "verified", header: "Verified hours", align: "right", width: 1.6 },
              { key: "pending", header: "Pending hours", align: "right", width: 1.6 },
              { key: "duties", header: "Duties", align: "right", width: 1.1 },
              { key: "lastDuty", header: "Last duty", width: 2.4 },
            ],
            rows,
          },
        ],
      };
    }

    case "LEADERSHIP": {
      const dash = buildDashboard({
        now: data.now,
        range: data.range as DateRange,
        people: data.people
          .filter((p) => filters.teamId === "ALL" || p.teamId === filters.teamId)
          .map((p) => ({ ...p })),
        meetings: data.meetings.filter((m) => filters.meetingType === "ALL" || m.type === filters.meetingType),
        records: data.records,
        issues: data.issues,
        teams: data.teams.filter((t) => filters.teamId === "ALL" || t.id === filters.teamId),
        lateWeight: data.lateWeight,
        thresholds: data.thresholds,
        atRiskPercent: data.atRiskPercent,
        atRiskAbsences: data.atRiskAbsences,
      });
      const sat = people.reduce((acc, p) => {
        for (const c of countedFor(p)) if (c.meeting.type === "SATURDAY") acc.push(c.status);
        return acc;
      }, [] as AttendanceStatus[]);
      const thu = people.reduce((acc, p) => {
        for (const c of countedFor(p)) if (c.meeting.type === "THURSDAY_PRAYER") acc.push(c.status);
        return acc;
      }, [] as AttendanceStatus[]);
      const delta = (v: number | null) => (v === null ? "" : ` (${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)})`);
      return {
        ...base,
        summary: [
          ["Active members", `${dash.kpis.activeMembers.value}${delta(dash.kpis.activeMembers.delta)}`],
          ["Volunteers", `${dash.kpis.volunteers.value}${delta(dash.kpis.volunteers.delta)}`],
          ["Attendance", `${pct(dash.kpis.averageAttendance.value)}${delta(dash.kpis.averageAttendance.delta)}`],
          ["On-time rate", `${pct(dash.kpis.onTimeRate.value)}${delta(dash.kpis.onTimeRate.delta)}`],
          ["Saturday attendance", pct(attendancePercent(tally(sat), data.lateWeight))],
          ["Thursday attendance", pct(attendancePercent(tally(thu), data.lateWeight))],
          ["Meetings held", String(meetings.length)],
          ["At risk", String(dash.atRisk.length)],
          ["Waiting for approval", String(dash.kpis.pendingApprovals.value)],
          ["Open issues", String(dash.kpis.openIssues.value)],
        ],
        tables: [
          {
            title: "Teams",
            columns: [
              { key: "team", header: "Team", width: 3 },
              { key: "people", header: "People", align: "right", width: 1 },
              { key: "attendance", header: "Attendance", align: "right", width: 1.5 },
            ],
            rows: dash.byTeam.map((t) => ({ team: t.team, people: t.people, attendance: pct(t.attendance) })),
          },
          {
            title: "At risk",
            columns: [
              { key: "name", header: "Name", width: 3 },
              { key: "percent", header: "Overall", align: "right", width: 1.2 },
              { key: "reason", header: "Why", width: 2.5 },
            ],
            rows: dash.atRisk.map((a) => ({ name: a.name, percent: pct(a.percent), reason: a.reason })),
            note: dash.atRisk.length ? undefined : "Nobody is at risk.",
          },
          {
            title: "Most consistent",
            columns: [
              { key: "rank", header: "#", align: "right", width: 0.6 },
              { key: "name", header: "Name", width: 3 },
              { key: "percent", header: "Overall", align: "right", width: 1.2 },
            ],
            rows: dash.topConsistent
              .slice(0, 5)
              .map((t, i) => ({ rank: i + 1, name: t.name, percent: pct(t.percent) })),
          },
        ],
      };
    }
  }
}

export const STATUS_WORDS = STATUS_WORD;
