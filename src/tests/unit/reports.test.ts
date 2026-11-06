// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { neutralizeCell, toCsv } from "@/lib/reports/csv";
import { googleCalendarUrl, meetingIcs, outlookCalendarUrl } from "@/lib/reports/calendar";
import { buildMemberReport, resolvePeriod } from "@/lib/reports/member-report";
import { heatCells } from "@/lib/attendance/heatmap";
import { qrCodeFor, verifyQrCode } from "@/lib/attendance/qr";
import { buildSeed, SEED_NOW } from "@/data/seed";
import { lagosTime } from "@/lib/time/zone";

describe("CSV export (spec 12)", () => {
  it.each([
    ["=SUM(A1:A9)", "'=SUM(A1:A9)"],
    ["+2348030000000", "'+2348030000000"],
    ["-1", "'-1"],
    ["@cmd", "'@cmd"],
    ["Adebayo", "Adebayo"],
    [null, ""],
  ])("neutralises %s", (input, out) => {
    expect(neutralizeCell(input)).toBe(out);
  });
  it("quotes commas, quotes and new lines, with a BOM and CRLF", () => {
    const csv = toCsv(
      [{ a: 'He said "hi", twice', b: "line1\nline2" }],
      [
        { header: "A", value: (r) => r.a },
        { header: "B", value: (r) => r.b },
      ],
    );
    expect(csv).toBe('﻿A,B\r\n"He said ""hi"", twice","line1\nline2"\r\n');
  });
});

describe("calendar files and links", () => {
  const m = {
    id: "mtg-2026-11-07-sat",
    title: "Saturday Sanitation Meeting",
    startsAt: lagosTime(2026, 11, 7, 9, 30).toISO()!,
    endsAt: null,
    status: "SCHEDULED",
  };
  const ctx = { address: "7 Surulere Industrial Road, Ikeja, Lagos", appUrl: "https://hub.example.com" };
  it("builds a valid .ics event in UTC with a reminder", () => {
    const ics = meetingIcs(m, ctx);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20261107T083000Z");
    expect(ics).toContain("DTEND:20261107T103000Z");
    expect(ics).toContain("UID:mtg-2026-11-07-sat@hod-sanitation-hub");
    expect(ics).toContain("BEGIN:VALARM");
  });
  it("marks cancelled meetings and drops the reminder", () => {
    const ics = meetingIcs({ ...m, status: "CANCELLED" }, ctx);
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toContain("BEGIN:VALARM");
  });
  it("makes Google and Outlook links", () => {
    const g = new URL(googleCalendarUrl(m, ctx));
    expect(g.searchParams.get("dates")).toBe("20261107T083000Z/20261107T103000Z");
    expect(g.searchParams.get("text")).toBe("Saturday Sanitation Meeting");
    const o = new URL(outlookCalendarUrl(m, ctx));
    expect(o.searchParams.get("startdt")).toBe("2026-11-07T08:30:00Z");
    expect(o.searchParams.get("location")).toBe(ctx.address);
  });
});

describe("member report", () => {
  const seed = buildSeed();
  const adebayo = seed.users.find((u) => u.id === seed.demo.adebayo)!;
  const records = seed.records.filter((r) => r.userId === adebayo.id);

  it("uses the same numbers as everywhere else for the whole history", () => {
    const r = buildMemberReport({
      person: adebayo,
      records,
      meetings: seed.meetings,
      period: resolvePeriod("all", SEED_NOW),
      now: SEED_NOW,
    });
    expect(r.overall.percent).toBe(88);
    expect(r.rows).toHaveLength(50);
    expect(r.rows[0].date >= r.rows.at(-1)!.date).toBe(true);
    expect(r.currentStreak).toBe(6);
  });
  it("restricts to a period", () => {
    const oct = buildMemberReport({
      person: adebayo,
      records,
      meetings: seed.meetings,
      period: resolvePeriod("custom", SEED_NOW, { from: "2026-10-01", to: "2026-10-31" }),
      now: SEED_NOW,
    });
    expect(oct.rows.every((x) => x.date.startsWith("2026-10"))).toBe(true);
    expect(oct.rows).toHaveLength(10);
    expect(oct.overall.counts.absent).toBe(1);
  });
  it.each([
    ["this-month", "1 Nov 2026 to 30 Nov 2026"],
    ["last-month", "1 Oct 2026 to 31 Oct 2026"],
    ["year-to-date", "1 Jan 2026 to 6 Nov 2026"],
  ] as const)("labels %s", (key, label) => {
    expect(resolvePeriod(key, SEED_NOW).label).toBe(label);
  });
});

describe("heatmap cells", () => {
  it("covers Saturday and Thursday meetings in the last 12 months, with cancelled and missing ones", () => {
    const seed = buildSeed();
    const recs = seed.records.filter((r) => r.userId === seed.demo.adebayo);
    const cells = heatCells(seed.meetings, recs, SEED_NOW);
    expect(cells).toHaveLength(52);
    expect(cells.filter((c) => c.status === "CANCELLED")).toHaveLength(1);
    expect(cells.find((c) => c.date.startsWith("2026-11-05"))!.status).toBe("NONE");
  });
});

describe("rotating QR code", () => {
  const secret = "test-secret-that-is-long-enough-for-hmac-signing";
  it("changes every 30 seconds and accepts the previous code", async () => {
    const t = DateTime.fromISO("2026-11-07T08:20:00Z").toMillis();
    const a = await qrCodeFor("m1", t, secret);
    const b = await qrCodeFor("m1", t + 30_000, secret);
    expect(a).toMatch(/^[A-Z2-9]{6}$/);
    expect(a).not.toBe(b);
    expect(await verifyQrCode("m1", a.toLowerCase(), t + 5_000, secret)).toBe(true);
    expect(await verifyQrCode("m1", a, t + 30_000, secret)).toBe(true);
    expect(await verifyQrCode("m1", a, t + 60_000, secret)).toBe(false);
    expect(await verifyQrCode("m2", a, t, secret)).toBe(false);
    expect(await verifyQrCode("m1", undefined, t, secret)).toBe(false);
  });
});
