import { DateTime } from "luxon";
import type { AttendanceRecord, Meeting, RecordMethod } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import {
  countedMeetings,
  currentStreak,
  longestStreak,
  tally,
  toView,
  type AttendanceView,
} from "@/lib/attendance/aggregate";
import type { BandThresholds } from "@/lib/attendance/percentage";

/**
 * One member's statement for a period (spec 7.2 "My report"). The same data feeds the on-screen
 * preview, the PDF and the CSV, so the numbers always match.
 */

export type PeriodKey = "this-month" | "last-month" | "last-3-months" | "year-to-date" | "all" | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  "year-to-date": "Year to date",
  all: "Since I joined",
  custom: "Custom dates",
};

export interface Period {
  key: PeriodKey;
  from: DateTime;
  to: DateTime;
  label: string;
}

/** Resolve a period in Lagos time. `custom` takes yyyy-mm-dd dates (inclusive). */
export function resolvePeriod(
  key: PeriodKey,
  now: DateTime,
  custom?: { from?: string | null; to?: string | null },
): Period {
  const l = now.setZone(MEETING_ZONE);
  const range = (from: DateTime, to: DateTime) => ({ from: from.toUTC(), to: to.toUTC() });
  let r: { from: DateTime; to: DateTime };
  switch (key) {
    case "this-month":
      r = range(l.startOf("month"), l.endOf("month"));
      break;
    case "last-month":
      r = range(l.minus({ months: 1 }).startOf("month"), l.minus({ months: 1 }).endOf("month"));
      break;
    case "last-3-months":
      r = range(l.minus({ months: 3 }).startOf("day"), l.endOf("day"));
      break;
    case "year-to-date":
      r = range(l.startOf("year"), l.endOf("day"));
      break;
    case "all":
      r = range(DateTime.fromObject({ year: 2000 }, { zone: MEETING_ZONE }), l.endOf("day"));
      break;
    case "custom": {
      const f = custom?.from ? DateTime.fromISO(custom.from, { zone: MEETING_ZONE }) : l.minus({ months: 1 });
      const t = custom?.to ? DateTime.fromISO(custom.to, { zone: MEETING_ZONE }) : l;
      const [a, b] = f.isValid && t.isValid && f <= t ? [f, t] : [l.minus({ months: 1 }), l];
      r = range(a.startOf("day"), b.endOf("day"));
      break;
    }
  }
  const fmt = (d: DateTime) => d.setZone(MEETING_ZONE).toFormat("d LLL yyyy");
  return { key, ...r, label: key === "all" ? `Since joining to ${fmt(r.to)}` : `${fmt(r.from)} to ${fmt(r.to)}` };
}

export interface ReportRow {
  meetingId: string;
  date: string;
  dateLabel: string;
  meeting: string;
  type: Meeting["type"];
  status: AttendanceRecord["status"];
  checkInTime: string | null;
  method: RecordMethod;
}

export interface MemberReport {
  person: { name: string; email: string };
  period: { label: string; from: string; to: string };
  generatedAt: string;
  overall: AttendanceView;
  saturday: AttendanceView;
  thursday: AttendanceView;
  currentStreak: number;
  longestStreak: number;
  rows: ReportRow[];
}

const METHOD_LABEL: Record<RecordMethod, string> = { GEO: "Check-in", SHEET: "Attendee sheet", MANUAL: "Marshal" };
export const methodLabel = (m: RecordMethod) => METHOD_LABEL[m];

export function buildMemberReport(input: {
  person: { name: string; email: string; approvedAt: string | null };
  records: AttendanceRecord[];
  meetings: Meeting[];
  period: Period;
  now: DateTime;
  lateWeight?: number;
  thresholds?: BandThresholds;
}): MemberReport {
  const { person, records, meetings, period, now } = input;
  const base = { approvedAt: person.approvedAt, now, from: period.from, to: period.to };
  const counted = countedMeetings(records, meetings, base);
  const view = (type?: Meeting["type"]) =>
    toView(
      tally(counted.filter((c) => !type || c.meeting.type === type).map((c) => c.status)),
      input.lateWeight,
      input.thresholds,
    );
  const byId = new Map(records.map((r) => [r.meetingId, r]));
  const rows: ReportRow[] = counted
    .map(({ meeting, status }) => {
      const rec = byId.get(meeting.id)!;
      const start = DateTime.fromISO(meeting.startsAt, { zone: "utc" }).setZone(MEETING_ZONE);
      const m = meetings.find((x) => x.id === meeting.id)!;
      return {
        meetingId: meeting.id,
        date: start.toISODate()!,
        dateLabel: start.toFormat("ccc d LLL yyyy"),
        meeting: m.title,
        type: meeting.type,
        status,
        checkInTime: rec.checkedInAt
          ? DateTime.fromISO(rec.checkedInAt, { zone: "utc" }).setZone(MEETING_ZONE).toFormat("h:mm a").toLowerCase()
          : null,
        method: rec.method,
      };
    })
    .reverse();
  const allCounted = countedMeetings(records, meetings, { approvedAt: person.approvedAt, now });
  return {
    person: { name: person.name, email: person.email },
    period: { label: period.label, from: period.from.toISO()!, to: period.to.toISO()! },
    generatedAt: now.toISO()!,
    overall: view(),
    saturday: view("SATURDAY"),
    thursday: view("THURSDAY_PRAYER"),
    currentStreak: currentStreak(allCounted),
    longestStreak: longestStreak(counted),
    rows,
  };
}
