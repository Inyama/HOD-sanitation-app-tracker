import { describe, expect, it } from "vitest";
import { buildUploadRecords, parseSheetTime, planReplacement, type Resolution } from "@/lib/matching/upload";
import { matchSheet } from "@/lib/matching/matchSheet";
import { lagosTime } from "@/lib/time/zone";

const start = lagosTime(2026, 11, 5, 20, 30).toISO()!;
const approved = lagosTime(2026, 1, 1).toISO()!;

describe("parseSheetTime", () => {
  it.each([
    ["20:41", "2026-11-05T19:41:00.000Z"],
    ["8:41 pm", "2026-11-05T19:41:00.000Z"],
    ["8:41PM", "2026-11-05T19:41:00.000Z"],
    ["20:29:30", "2026-11-05T19:29:30.000Z"],
    ["2026-11-05T20:35:00+01:00", "2026-11-05T19:35:00.000Z"],
  ])("%s", (raw, expected) => {
    expect(parseSheetTime(raw, start)?.toISO()).toBe(expected);
  });
  it("returns null for blanks and nonsense", () => {
    expect(parseSheetTime("", start)).toBeNull();
    expect(parseSheetTime("soon", start)).toBeNull();
  });
});

describe("confirming an upload", () => {
  const people = [
    { id: "a", name: "Adebayo Johnson", email: "a@example.com", status: "ACTIVE" as const, approvedAt: approved },
    { id: "b", name: "Ngozi Eze", email: "b@example.com", status: "ACTIVE" as const, approvedAt: approved },
    { id: "c", name: "Chioma Okafor", email: "c@example.com", status: "ACTIVE" as const, approvedAt: approved },
    { id: "d", name: "Emeka Obi", email: "d@example.com", status: "ACTIVE" as const, approvedAt: approved },
    {
      id: "e",
      name: "New Joiner",
      email: "e@example.com",
      status: "ACTIVE" as const,
      approvedAt: lagosTime(2026, 11, 6).toISO()!,
    },
    { id: "p", name: "Samuel Bello", email: "p@example.com", status: "PENDING" as const, approvedAt: null },
  ];
  const { rows } = matchSheet(
    [
      { name: "Ngozi Eze", email: "b@example.com", time: "20:29" },
      { name: "Adebayo Jonhson", email: null, time: "20:42" },
      { name: "Kelechi Nnamdi", email: "k@example.com", time: "20:26" },
      { name: "Ngozi Eze", email: "b@example.com", time: "20:29" },
    ],
    people,
  );

  it("marks matched people present (late after the start), and expected people absent or excused", () => {
    const resolutions = new Map<number, Resolution>([[1, { kind: "ACCEPT" }]]);
    const drafts = buildUploadRecords({
      meetingStartIso: start,
      graceMinutes: 0,
      matches: rows,
      resolutions,
      expected: people,
      approvedExcuseUserIds: new Set(["d"]),
    });
    const byUser = Object.fromEntries(drafts.map((d) => [d.userId, d.status]));
    expect(byUser).toEqual({ b: "ON_TIME", a: "LATE", c: "ABSENT", d: "EXCUSED" });
    // Not yet approved (e) and pending (p) people are not expected.
  });

  it("ignores Suggested and Not found rows until the admin resolves them, and never double counts duplicates", () => {
    const drafts = buildUploadRecords({
      meetingStartIso: start,
      graceMinutes: 0,
      matches: rows,
      resolutions: new Map(),
      expected: people,
      approvedExcuseUserIds: new Set(),
    });
    expect(drafts.filter((d) => d.status === "ON_TIME" || d.status === "LATE").map((d) => d.userId)).toEqual(["b"]);
    expect(drafts.find((d) => d.userId === "a")!.status).toBe("ABSENT");
  });

  it("lets the admin assign a Not found row to a person", () => {
    const resolutions = new Map<number, Resolution>([[2, { kind: "ASSIGN", userId: "c" }]]);
    const drafts = buildUploadRecords({
      meetingStartIso: start,
      graceMinutes: 0,
      matches: rows,
      resolutions,
      expected: people,
      approvedExcuseUserIds: new Set(),
    });
    expect(drafts.find((d) => d.userId === "c")!.status).toBe("ON_TIME");
  });

  it("respects the grace period", () => {
    const resolutions = new Map<number, Resolution>([[1, { kind: "ACCEPT" }]]);
    const drafts = buildUploadRecords({
      meetingStartIso: start,
      graceMinutes: 15,
      matches: rows,
      resolutions,
      expected: people,
      approvedExcuseUserIds: new Set(),
    });
    expect(drafts.find((d) => d.userId === "a")!.status).toBe("ON_TIME");
  });

  it("re-uploading replaces earlier sheet records only", () => {
    const existing = [
      { id: "r1", userId: "a", method: "SHEET" },
      { id: "r2", userId: "b", method: "SHEET" },
      { id: "r3", userId: "c", method: "MANUAL" },
    ];
    const plan = planReplacement(existing, [
      { userId: "a", status: "ON_TIME", checkedInAt: null, rawTime: null },
      { userId: "c", status: "ABSENT", checkedInAt: null, rawTime: null },
    ]);
    expect(plan.deleteIds).toEqual(["r1", "r2"]);
    expect(plan.insert.map((d) => d.userId)).toEqual(["a"]);
  });
});
