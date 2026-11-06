import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { normalizeEmail, normalizeName } from "@/lib/matching/normalize";
import { editDistance, similarity } from "@/lib/matching/similarity";
import { detectColumns } from "@/lib/matching/columns";
import { matchSheet, type MatchPerson } from "@/lib/matching/matchSheet";
import { checkFile, isParseError, parseCsv, parseXlsx, MAX_UPLOAD_ROWS } from "@/lib/matching/parse";

const people: MatchPerson[] = [
  { id: "u1", name: "Adebayo Johnson", email: "member@hod-demo.example.com", status: "ACTIVE" },
  {
    id: "u2",
    name: "Ngozi Eze",
    email: "gold@hod-demo.example.com",
    secondaryEmail: "ngozi.personal@example.com",
    status: "ACTIVE",
  },
  { id: "u3", name: "Samuel Bello", email: "pending@hod-demo.example.com", status: "PENDING" },
  { id: "u4", name: "Victor Nwosu", email: "suspended@hod-demo.example.com", status: "SUSPENDED" },
  { id: "u5", name: "Removed Person", email: "gone@example.com", status: "REMOVED" },
];

describe("normalisation", () => {
  it("normalises emails", () => {
    expect(normalizeEmail("  Member@HOD-demo.Example.com ")).toBe("member@hod-demo.example.com");
  });
  it("strips accents and punctuation and sorts name parts", () => {
    expect(normalizeName("Ngózi  Ézè")).toBe("eze ngozi");
    expect(normalizeName("Johnson, Adebayo")).toBe(normalizeName("Adebayo Johnson"));
    expect(normalizeName("O'Brien-Smith")).toBe("brien o smith");
  });
});

describe("similarity", () => {
  it("is 1 for identical names in any order", () => {
    expect(similarity("Adebayo Johnson", "JOHNSON Adebayo")).toBe(1);
  });
  it("treats a swapped-letter typo as one edit, so it reaches the 0.90 threshold", () => {
    expect(editDistance("jonhson", "johnson")).toBe(1);
    expect(similarity("Adebayo Jonhson", "Adebayo Johnson")).toBeGreaterThanOrEqual(0.9);
  });
  it("ignores accents", () => {
    expect(similarity("Ngózi Ézè", "Ngozi Eze")).toBe(1);
  });
  it("scores different people low", () => {
    expect(similarity("Kelechi Nnamdi", "Adebayo Johnson")).toBeLessThan(0.5);
  });
});

describe("matchSheet (spec 6.4 order of matching)", () => {
  it("matches exact email (primary or secondary), suggests close names, and reports the rest", () => {
    const { rows, summary } = matchSheet(
      [
        { name: "Adebayo J.", email: "MEMBER@hod-demo.example.com" },
        { name: "Ngozi", email: "ngozi.personal@example.com" },
        { name: "Adebayo Jonhson", email: null },
        { name: "Kelechi Nnamdi", email: "kelechi@example.com" },
      ],
      people,
    );
    expect(rows.map((r) => [r.matchType, r.matchedUserId])).toEqual([
      ["EMAIL", "u1"],
      ["EMAIL", "u2"],
      ["NAME_SUGGESTED", "u1"],
      ["NOT_FOUND", null],
    ]);
    expect(summary).toMatchObject({ total: 4, matched: 2, suggested: 1, notFound: 1, duplicates: 0, exceptions: 2 });
  });

  it("keeps a repeated email or name once and marks the rest Duplicate", () => {
    const { rows, summary } = matchSheet(
      [
        { name: "Ngozi Eze", email: "gold@hod-demo.example.com" },
        { name: "Ngozi Eze", email: "gold@hod-demo.example.com" },
        { name: "Eze Ngozi", email: null },
      ],
      people,
    );
    expect(rows.map((r) => r.matchType)).toEqual(["EMAIL", "DUPLICATE", "DUPLICATE"]);
    expect(rows[1].duplicateOf).toBe(0);
    expect(summary.duplicates).toBe(2);
  });

  it("does not treat blank emails as duplicates of each other", () => {
    const { rows } = matchSheet(
      [
        { name: "Adebayo Jonhson", email: null },
        { name: "Kelechi Nnamdi", email: null },
      ],
      people,
    );
    expect(rows.map((r) => r.matchType)).toEqual(["NAME_SUGGESTED", "NOT_FOUND"]);
  });

  it("warns on Pending or Suspended people and never matches Removed ones", () => {
    const { rows } = matchSheet(
      [
        { name: "Samuel Bello", email: "pending@hod-demo.example.com" },
        { name: "Victor Nwosu", email: "suspended@hod-demo.example.com" },
        { name: "Removed Person", email: "gone@example.com" },
      ],
      people,
    );
    expect(rows.map((r) => r.warning)).toEqual(["PENDING_ACCOUNT", "SUSPENDED_ACCOUNT", null]);
    expect(rows[2].matchType).toBe("NOT_FOUND");
  });
});

describe("column detection and parsing", () => {
  it("detects headers case-insensitively with synonyms", () => {
    expect(detectColumns(["Full Name", "E-mail", "Mobile", "Check-in Time"])).toEqual({
      map: { name: 0, email: 1, phone: 2, time: 3 },
      missing: [],
    });
    expect(detectColumns(["NAME", "EMAIL ADDRESS"]).missing).toEqual([]);
    expect(detectColumns(["Attendee", "Phone"]).missing).toEqual(["email"]);
  });

  it("parses CSV, skipping blank rows", () => {
    const parsed = parseCsv(
      "﻿Full Name,E-mail,Check-in Time\nAdebayo Johnson,member@hod-demo.example.com,20:21\n,,\nNgozi Eze,gold@hod-demo.example.com,20:44\n",
    );
    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[1]).toMatchObject({ name: "Ngozi Eze", email: "gold@hod-demo.example.com", time: "20:44" });
    }
  });

  it("reports missing columns so the admin can map them", () => {
    const parsed = parseCsv("Who,Where\nA,B\n");
    expect(parsed).toMatchObject({ code: "MISSING_COLUMNS", missing: ["name", "email"] });
    const mapped = parseCsv("Who,Where\nA,b@example.com\n", { name: 0, email: 1 });
    expect(isParseError(mapped)).toBe(false);
  });

  it("parses XLSX workbooks", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Name", "Email"],
        ["Grace Adeyemi", "volunteer@hod-demo.example.com"],
      ]),
      "Sheet1",
    );
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const parsed = parseXlsx(buf);
    expect(isParseError(parsed) ? parsed : parsed.rows).toEqual([
      { name: "Grace Adeyemi", email: "volunteer@hod-demo.example.com", phone: null, time: null, status: null },
    ]);
  });

  it("accepts only CSV and XLSX up to 5 MB and 5,000 rows", () => {
    expect(checkFile("sheet.csv", 1000)).toBeNull();
    expect(checkFile("sheet.XLSX", 1000)).toBeNull();
    expect(checkFile("sheet.pdf", 1000)?.code).toBe("UNSUPPORTED_TYPE");
    expect(checkFile("sheet.csv", 5 * 1024 * 1024 + 1)?.code).toBe("TOO_LARGE");
    const big = [
      "Name,Email",
      ...Array.from({ length: MAX_UPLOAD_ROWS + 1 }, (_, i) => `P${i},p${i}@example.com`),
    ].join("\n");
    expect(parseCsv(big)).toMatchObject({ code: "TOO_MANY_ROWS" });
  });
});
