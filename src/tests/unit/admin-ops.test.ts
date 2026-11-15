import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import * as XLSX from "xlsx";
import {
  buildMeetings,
  calendarMonth,
  changeNotice,
  checkChange,
  specialId,
  type MeetingForm,
} from "@/lib/admin/meetings";
import { correctionPatch } from "@/lib/admin/corrections";
import { canPlace, suggestRoster } from "@/lib/admin/roster";
import {
  decodeResolution,
  encodeResolution,
  expectedPeople,
  ignoredCount,
  matchesFromRows,
  summarizeDrafts,
  undecided,
} from "@/lib/admin/uploads";
import { absenceDrafts, closesAt, needsClosing } from "@/lib/attendance/close";
import { buildAnalytics } from "@/lib/admin/analytics";
import { buildReport, type ReportData } from "@/lib/reports/admin-reports";
import { reportCsv, reportXlsx } from "@/lib/reports/render";
import { resolveRange } from "@/lib/admin/range";
import { meetingId } from "@/lib/time/schedule";
import type { Meeting } from "@/lib/repo/types";

const lagos = (iso: string) => DateTime.fromISO(iso, { zone: "Africa/Lagos" });
const NOW = lagos("2026-11-09T12:00");

const form = (over: Partial<MeetingForm> = {}): MeetingForm => ({
  type: "SATURDAY",
  title: "Saturday Sanitation Meeting",
  date: "2026-11-14",
  time: "09:30",
  durationMin: 120,
  method: "GEO",
  openBeforeMin: 60,
  closeAfterMin: 120,
  graceMinutes: 0,
  radiusM: null,
  requireQr: false,
  repeatWeeks: 1,
  ...over,
});

const meeting = (over: Partial<Meeting> = {}): Meeting => ({
  id: "mtg-2026-11-07-sat",
  type: "SATURDAY",
  title: "Saturday Sanitation Meeting",
  startsAt: lagos("2026-11-07T09:30").toUTC().toISO()!,
  endsAt: lagos("2026-11-07T11:30").toUTC().toISO()!,
  venueId: "ven-1",
  method: "GEO",
  graceMinutes: 0,
  openBeforeMin: 60,
  closeAfterMin: 120,
  status: "SCHEDULED",
  recurrenceRule: null,
  requireQr: false,
  statusNote: null,
  ...over,
});

describe("meetings", () => {
  it("a Saturday row uses the weekly id, so it replaces the generated meeting for that week", () => {
    const [m] = buildMeetings(form(), "ven-1", []);
    expect(m.id).toBe(meetingId("SATURDAY", lagos("2026-11-14T09:30")));
    expect(m.recurrenceRule).toContain("FREQ=WEEKLY");
    expect(DateTime.fromISO(m.startsAt).setZone("Africa/Lagos").toFormat("ccc HH:mm")).toBe("Sat 09:30");
  });

  it("repeats weekly up to 12 weeks, and sheet meetings have no check-in window or radius", () => {
    const rows = buildMeetings(
      form({ type: "SPECIAL", title: "Training", method: "SHEET", radiusM: 150, requireQr: true, repeatWeeks: 20 }),
      null,
      ["a", "b"],
    );
    expect(rows).toHaveLength(12);
    expect(rows[0].id).toBe(specialId(lagos("2026-11-14T09:30"), "a"));
    expect(rows[1].startsAt > rows[0].startsAt).toBe(true);
    expect(rows[0]).toMatchObject({ openBeforeMin: 0, closeAfterMin: 0, radiusM: null, requireQr: false });
  });

  it("only meetings that have not started can be moved or cancelled", () => {
    const future = meeting({ startsAt: lagos("2026-11-14T09:30").toUTC().toISO()! });
    expect(checkChange(meeting(), NOW)).toBe("ALREADY_HELD");
    expect(checkChange({ ...future, status: "CANCELLED" }, NOW)).toBe("CANCELLED");
    expect(checkChange(future, NOW)).toBeNull();
    expect(checkChange(future, NOW, lagos("2026-11-08T09:30").toUTC())).toBe("IN_PAST");
    expect(checkChange(future, NOW, lagos("2026-11-14T09:30").toUTC())).toBe("SAME_TIME");
    expect(checkChange(future, NOW, lagos("2026-11-15T09:30").toUTC(), [{ startsAt: "x" }])).toBe("CLASH");
    expect(checkChange(future, NOW, lagos("2026-11-15T09:30").toUTC())).toBeNull();
  });

  it("notices say what changed, in Lagos time, with the reason", () => {
    const m = meeting({ startsAt: lagos("2026-11-14T09:30").toUTC().toISO()! });
    const c = changeNotice("CANCELLED", m, "The hall is closed.");
    expect(c.body).toContain("Saturday 14 November at 9:30 am");
    expect(c.body).toContain("does not count");
    const r = changeNotice("RESCHEDULED", m, "Wedding in the hall.", lagos("2026-11-15T10:00"));
    expect(r.title).toContain("Sun 15 Nov, 10:00 am");
    expect(r.statusNote.startsWith("Rescheduled")).toBe(true);
  });

  it("the month calendar starts on Monday and places meetings on their Lagos day", () => {
    const weeks = calendarMonth([meeting()], "2026-11", NOW);
    expect(weeks[0][0].date).toBe("2026-10-26");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const day = weeks.flat().find((d) => d.date === "2026-11-07")!;
    expect(day.meetings[0]).toMatchObject({ title: "Saturday Sanitation Meeting", time: "9:30 am" });
    expect(weeks.flat().find((d) => d.isToday)?.date).toBe("2026-11-09");
  });
});

describe("corrections", () => {
  const m = { startsAt: lagos("2026-11-07T09:30").toUTC().toISO()!, graceMinutes: 0 };
  const rec = { status: "ABSENT" as const, checkedInAt: null, flagged: true };

  it("changes a record, marks it Manual and clears the flag", () => {
    const r = correctionPatch(rec, m, { status: "LATE", reason: "Marshal saw them", arrivedAt: "09:45" }, "adm", NOW);
    expect(r.ok && r.patch).toMatchObject({
      status: "LATE",
      method: "MANUAL",
      flagged: false,
      recordedById: "adm",
      note: "Marshal saw them",
    });
    expect(r.ok && DateTime.fromISO(r.patch.checkedInAt!).setZone("Africa/Lagos").toFormat("HH:mm")).toBe("09:45");
  });

  it("refuses a time that does not fit the status, no-op changes and future meetings", () => {
    expect(correctionPatch(rec, m, { status: "ON_TIME", reason: "x", arrivedAt: "09:45" }, "a", NOW)).toEqual({
      ok: false,
      error: "TIME_STATUS_MISMATCH",
    });
    expect(correctionPatch(rec, m, { status: "ABSENT", reason: "x" }, "a", NOW)).toEqual({
      ok: false,
      error: "NO_CHANGE",
    });
    expect(
      correctionPatch(
        rec,
        { ...m, startsAt: lagos("2026-11-14T09:30").toUTC().toISO()! },
        { status: "LATE", reason: "x" },
        "a",
        NOW,
      ),
    ).toEqual({ ok: false, error: "FUTURE_MEETING" });
  });

  it("Absent and Excused clear the check-in time", () => {
    const r = correctionPatch(
      { status: "LATE", checkedInAt: "2026-11-07T08:40:00Z", flagged: false },
      m,
      { status: "EXCUSED", reason: "Excuse came late" },
      "a",
      NOW,
    );
    expect(r.ok && r.patch.checkedInAt).toBeNull();
  });
});

describe("roster suggestions", () => {
  const zones = [
    { id: "z1", name: "Kitchen", capacity: 2 },
    { id: "z2", name: "Sanctuary", capacity: 1 },
  ];
  const volunteers = [
    { id: "a", name: "Ada", teamZoneId: null },
    { id: "b", name: "Ben", teamZoneId: "z2" },
    { id: "c", name: "Cy", teamZoneId: null },
    { id: "d", name: "Dee", teamZoneId: null },
  ];

  it("fills open spots by past zone, then team zone, then fewest duties, never twice", () => {
    const s = suggestRoster({
      zones,
      volunteers,
      past: [
        { userId: "a", zoneId: "z1", status: "DONE" },
        { userId: "a", zoneId: "z1", status: "DONE" },
        { userId: "c", zoneId: "z2", status: "DONE" },
      ],
      current: [],
      unavailable: new Set(["d"]),
    });
    expect(s).toHaveLength(3);
    expect(new Set(s.map((x) => x.userId)).size).toBe(3);
    expect(s.find((x) => x.userId === "a")).toMatchObject({ zoneId: "z1", reason: "Served here 2 times" });
    expect(s.find((x) => x.userId === "c")?.zoneId).toBe("z2");
    expect(s.some((x) => x.userId === "d")).toBe(false);
  });

  it("people already on the roster and full zones are left alone", () => {
    const current = [{ userId: "b", zoneId: "z2", status: "ASSIGNED" as const }];
    expect(
      suggestRoster({ zones, volunteers, past: [], current }).some((x) => x.userId === "b" || x.zoneId === "z2"),
    ).toBe(false);
    expect(canPlace(zones[1], current, "a")).toBe("FULL");
    expect(canPlace(zones[1], current, "b")).toBe("SAME_ZONE");
    expect(canPlace(zones[0], current, "b")).toBe("OK");
  });
});

describe("upload helpers", () => {
  it("expected people are active, approved by the start, and not Remote on Saturdays", () => {
    const start = lagos("2026-11-07T09:30").toUTC().toISO()!;
    const people = [
      { id: "1", status: "ACTIVE" as const, approvedAt: "2026-01-01T00:00:00Z", isRemote: false },
      { id: "2", status: "ACTIVE" as const, approvedAt: "2026-01-01T00:00:00Z", isRemote: true },
      { id: "3", status: "PENDING" as const, approvedAt: null, isRemote: false },
      { id: "4", status: "ACTIVE" as const, approvedAt: "2026-11-08T00:00:00Z", isRemote: false },
    ];
    expect(expectedPeople({ type: "SATURDAY", startsAt: start }, people).map((p) => p.id)).toEqual(["1"]);
    expect(expectedPeople({ type: "THURSDAY_PRAYER", startsAt: start }, people).map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("decisions round-trip and suggested rows wait for one", () => {
    for (const r of [{ kind: "ACCEPT" }, { kind: "IGNORE" }, { kind: "ASSIGN", userId: "usr-x" }] as const)
      expect(decodeResolution(encodeResolution(r))).toEqual(r);
    expect(decodeResolution("CONFIRMED")).toEqual({ kind: "ACCEPT" });
    const rows = [
      {
        rawName: "Ada Obi",
        rawEmail: "ada@example.com",
        rawTime: null,
        matchedUserId: "u1",
        matchType: "EMAIL" as const,
        similarity: 1,
      },
      {
        rawName: "Ada Obi",
        rawEmail: "ada@example.com",
        rawTime: null,
        matchedUserId: "u1",
        matchType: "DUPLICATE" as const,
        similarity: null,
      },
      {
        rawName: "Bem Ojo",
        rawEmail: null,
        rawTime: null,
        matchedUserId: "u2",
        matchType: "NAME_SUGGESTED" as const,
        similarity: 0.93,
      },
      {
        rawName: "Nobody",
        rawEmail: "x@example.com",
        rawTime: null,
        matchedUserId: null,
        matchType: "NOT_FOUND" as const,
        similarity: null,
      },
    ];
    const matches = matchesFromRows(rows, (id) => (id === "u2" ? "SUSPENDED" : "ACTIVE"));
    expect(matches[1].duplicateOf).toBe(0);
    expect(matches[2].warning).toBe("SUSPENDED_ACCOUNT");
    expect(undecided(matches, new Map())).toHaveLength(1);
    expect(undecided(matches, new Map([[2, { kind: "ACCEPT" }]]))).toHaveLength(0);
    expect(ignoredCount(matches, new Map())).toBe(2);
    expect(summarizeDrafts([{ status: "ON_TIME" }, { status: "LATE" }, { status: "ABSENT" }], 1)).toEqual({
      present: 2,
      onTime: 1,
      late: 1,
      absent: 1,
      excused: 0,
      ignored: 1,
    });
  });
});

describe("closing a meeting", () => {
  it("closes when the window ends; sheet, cancelled and closed meetings are skipped", () => {
    const m = meeting();
    expect(closesAt(m).setZone("Africa/Lagos").toFormat("HH:mm")).toBe("11:30");
    expect(needsClosing(m, lagos("2026-11-07T11:29"))).toBe(false);
    expect(needsClosing(m, lagos("2026-11-07T11:30"))).toBe(true);
    expect(needsClosing({ ...m, status: "CLOSED" }, NOW)).toBe(false);
    expect(needsClosing({ ...m, status: "CANCELLED" }, NOW)).toBe(false);
    expect(needsClosing({ ...m, method: "SHEET" }, NOW)).toBe(false);
  });

  it("writes Absent, or Excused with an approved excuse, only for expected people without a record", () => {
    const people = [
      { id: "1", status: "ACTIVE" as const, approvedAt: "2026-01-01T00:00:00Z", isRemote: false },
      { id: "2", status: "ACTIVE" as const, approvedAt: "2026-01-01T00:00:00Z", isRemote: false },
      { id: "3", status: "ACTIVE" as const, approvedAt: "2026-01-01T00:00:00Z", isRemote: false },
      { id: "4", status: "ACTIVE" as const, approvedAt: "2026-01-01T00:00:00Z", isRemote: true },
      { id: "5", status: "SUSPENDED" as const, approvedAt: "2026-01-01T00:00:00Z", isRemote: false },
    ];
    expect(absenceDrafts(meeting(), people, new Set(["1"]), new Set(["3"]))).toEqual([
      { userId: "2", status: "ABSENT" },
      { userId: "3", status: "EXCUSED" },
    ]);
  });
});

// ---- Reports and analytics on a tiny unit --------------------------------------------------

function tinyData(): ReportData {
  const now = lagos("2026-11-09T12:00").toUTC();
  const range = resolveRange("2026-10-01..2026-11-09", now);
  const sats = ["2026-10-17", "2026-10-24", "2026-10-31"].map((d) =>
    meeting({ id: `mtg-${d}-sat`, startsAt: lagos(`${d}T09:30`).toUTC().toISO()!, status: "CLOSED" }),
  );
  const person = (id: string, name: string, teamId: string) => ({
    id,
    name,
    email: `${id}@example.com`,
    phone: '=HYPERLINK("x")',
    role: "MEMBER" as const,
    status: "ACTIVE" as const,
    approvedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    statusChangedAt: null,
    teamId,
    isRemote: false,
  });
  const rec = (userId: string, m: Meeting, status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED", min = 0) => ({
    id: `${userId}-${m.id}`,
    meetingId: m.id,
    userId,
    status,
    checkedInAt:
      status === "ON_TIME" || status === "LATE" ? DateTime.fromISO(m.startsAt).plus({ minutes: min }).toISO()! : null,
    method: "GEO" as const,
    lat: null,
    lng: null,
    accuracyM: null,
    distanceM: null,
    deviceId: null,
    flagged: false,
    flagReason: null,
    sourceUploadId: null,
    recordedById: null,
    note: null,
  });
  return {
    now,
    range,
    people: [person("u1", "Ada Obi", "t1"), person("u2", "=Bad Name", "t2")],
    meetings: sats,
    records: [
      rec("u1", sats[0], "ON_TIME", -5),
      rec("u1", sats[1], "LATE", 12),
      rec("u1", sats[2], "ON_TIME", -1),
      rec("u2", sats[0], "ABSENT"),
      rec("u2", sats[1], "EXCUSED"),
      rec("u2", sats[2], "LATE", 20),
    ],
    excuses: [],
    hours: [],
    duties: [],
    issues: [],
    teams: [
      { id: "t1", name: "Kitchen" },
      { id: "t2", name: "Sanctuary" },
    ],
    lateWeight: 1,
    thresholds: { gold: 90, green: 75, amber: 50 },
    atRiskPercent: 60,
    atRiskAbsences: 3,
  };
}

describe("admin reports", () => {
  const filters = { meetingType: "ALL" as const, teamId: "ALL", userId: null };

  it("member summary uses the shared percentage rules", () => {
    const r = buildReport("MEMBER_SUMMARY", tinyData(), filters);
    const ada = r.tables[0].rows.find((x) => x.name === "Ada Obi")!;
    expect(ada).toMatchObject({ counted: 3, onTime: 2, late: 1, percent: "100%", onTimeRate: "66.7%" });
    const bad = r.tables[0].rows.find((x) => x.name === "=Bad Name")!;
    expect(bad).toMatchObject({ counted: 3, excused: 1, percent: "50%" });
    expect(r.summary).toContainEqual(["Meetings held", "3"]);
  });

  it("register and late reports list every meeting and every late arrival", () => {
    const reg = buildReport("REGISTER", tinyData(), filters);
    expect(reg.tables[0].columns).toHaveLength(2 + 3 + 3);
    expect(reg.tables[0].rows.find((x) => x.name === "Ada Obi")!["mtg-2026-10-24-sat"]).toBe("L");
    const late = buildReport("LATE", tinyData(), filters);
    expect(late.tables[0].rows.map((x) => x.minutesLate).sort()).toEqual([12, 20]);
  });

  it("CSV and XLSX neutralise formulas and carry the title and period", () => {
    const r = buildReport("ABSENTEES", tinyData(), filters);
    const csv = reportCsv(r);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Absentees");
    expect(csv).toContain("'=Bad Name");
    expect(csv).toContain("'=HYPERLINK");
    const wb = XLSX.read(reportXlsx(r), { type: "buffer" });
    expect(wb.SheetNames[0]).toBe("Summary");
    const summary = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Summary, { header: 1 });
    expect(summary[0][0]).toBe("Absentees");
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[1]]);
    expect(rows[0].Name).toBe("'=Bad Name");
  });
});

describe("analytics", () => {
  it("builds cohorts, punctuality and a team leaderboard from the same rules", () => {
    const d = tinyData();
    const a = buildAnalytics({
      now: d.now,
      range: d.range,
      people: d.people,
      meetings: d.meetings,
      records: d.records,
      hours: [],
      teams: d.teams,
      lateWeight: 1,
      meetingType: "ALL",
      teamId: "ALL",
    });
    expect(a.leaderboard.map((t) => [t.team, t.attendance])).toEqual([
      ["Kitchen", 100],
      ["Sanctuary", 50],
    ]);
    const timed = a.punctuality.filter((p) => p.averageArrival !== null);
    expect(timed.length).toBeGreaterThan(0);
    expect(a.distribution.find((x) => x.attended === "3 of 3")?.people).toBe(1);
    expect(a.cohorts).toEqual([{ cohort: "Jan 2026", size: 2, firstThreeMonths: null, overall: 80, stillActive: 2 }]);
  });
});
