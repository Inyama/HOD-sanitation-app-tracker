import * as XLSX from "xlsx";
import { neutralizeCell } from "./csv";
import type { Cell, Report } from "./admin-reports";

/**
 * CSV and XLSX output for admin reports (spec 7.4 item 8, 12). Text cells that start with
 * =, +, - or @ are prefixed with an apostrophe in both formats, so no export can run a formula.
 */

function quote(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const line = (cells: unknown[]) => cells.map((c) => quote(neutralizeCell(c))).join(",");

/** One CSV: title block, summary figures, then each table under its own heading. */
export function reportCsv(r: Report): string {
  const out: string[] = [line([r.title]), line([r.period])];
  for (const f of r.filters) out.push(line([f]));
  out.push(line([`Generated ${r.generatedAt} (Lagos time)`]), "");
  for (const [k, v] of r.summary) out.push(line([k, v]));
  for (const t of r.tables) {
    out.push("", line([t.title]), line(t.columns.map((c) => c.header)));
    for (const row of t.rows) out.push(line(t.columns.map((c) => row[c.key])));
    if (t.note) out.push(line([t.note]));
  }
  return `﻿${out.join("\r\n")}\r\n`;
}

/** Numbers stay numbers; text is neutralised. */
function cellValue(v: Cell | undefined): string | number {
  if (v === null || v === undefined) return "";
  return typeof v === "number" ? v : neutralizeCell(v);
}

function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Sheet";
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base.slice(0, 26)} ${i++}`;
  used.add(name);
  return name;
}

/** XLSX with a Summary sheet first, then one sheet per table (spec: "XLSX with summary sheet"). */
export function reportXlsx(r: Report): Buffer {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const summary: (string | number)[][] = [
    [r.title],
    [r.period],
    ...r.filters.map((f) => [f]),
    [`Generated ${r.generatedAt} (Lagos time)`],
    [],
    ["Figure", "Value"],
    ...r.summary.map(([k, v]) => [neutralizeCell(k), neutralizeCell(v)]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"] = [{ wch: 34 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName("Summary", used));
  for (const t of r.tables) {
    const aoa: (string | number)[][] = [
      t.columns.map((c) => c.header),
      ...t.rows.map((row) => t.columns.map((c) => cellValue(row[c.key]))),
    ];
    if (t.note) aoa.push([], [neutralizeCell(t.note)]);
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = t.columns.map((c) => ({
      wch: Math.min(40, Math.max(c.header.length + 2, ...t.rows.map((row) => String(row[c.key] ?? "").length + 1))),
    }));
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(0, t.rows.length), c: t.columns.length - 1 },
      }),
    };
    XLSX.utils.book_append_sheet(wb, sheet, sheetName(t.title, used));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
