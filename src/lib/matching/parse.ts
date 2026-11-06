import Papa from "papaparse";
import * as XLSX from "xlsx";
import { detectColumns, type ColumnKey, type ColumnMap } from "./columns";
import type { SheetRow } from "./matchSheet";

/** Parsing and validation of uploaded CSV and XLSX sheets (spec 6.4, 12). Files are parsed in memory, never executed. */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_ROWS = 5000;
export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"] as const;

export type ParseError =
  | { code: "UNSUPPORTED_TYPE"; message: string }
  | { code: "TOO_LARGE"; message: string }
  | { code: "TOO_MANY_ROWS"; message: string }
  | { code: "MISSING_COLUMNS"; message: string; missing: ColumnKey[] }
  | { code: "EMPTY"; message: string };

export interface ParsedSheet {
  headers: string[];
  columns: ColumnMap;
  rows: SheetRow[];
  /** Rows dropped because both name and email were blank. */
  skippedBlank: number;
}

export function checkFile(name: string, sizeBytes: number): ParseError | null {
  const lower = name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((e) => lower.endsWith(e))) {
    return { code: "UNSUPPORTED_TYPE", message: "Upload a CSV or XLSX file." };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) return { code: "TOO_LARGE", message: "Files must be 5 MB or smaller." };
  return null;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Turn a header row plus data rows into SheetRows using detected (or admin-mapped) columns. */
export function rowsFromTable(table: unknown[][], mapping?: ColumnMap): ParsedSheet | ParseError {
  const nonEmpty = table.filter((r) => r.some((c) => cell(c) !== ""));
  if (nonEmpty.length === 0) return { code: "EMPTY", message: "The file has no rows." };
  const headers = nonEmpty[0].map(cell);
  const detected = detectColumns(headers);
  const columns = { ...detected.map, ...mapping };
  const missing = (["name", "email"] as const).filter((k) => columns[k] === undefined);
  if (missing.length) {
    return {
      code: "MISSING_COLUMNS",
      message: `Could not find the ${missing.join(" and ")} column${missing.length > 1 ? "s" : ""}. Map them by hand.`,
      missing: [...missing],
    };
  }
  const data = nonEmpty.slice(1);
  if (data.length > MAX_UPLOAD_ROWS)
    return { code: "TOO_MANY_ROWS", message: `Files can have up to ${MAX_UPLOAD_ROWS.toLocaleString("en-GB")} rows.` };
  const get = (r: unknown[], k: ColumnKey) => (columns[k] === undefined ? null : cell(r[columns[k]!]) || null);
  let skippedBlank = 0;
  const rows: SheetRow[] = [];
  for (const r of data) {
    const name = get(r, "name") ?? "";
    const email = get(r, "email");
    if (!name && !email) {
      skippedBlank++;
      continue;
    }
    rows.push({ name, email, phone: get(r, "phone"), time: get(r, "time"), status: get(r, "status") });
  }
  return { headers, columns, rows, skippedBlank };
}

export function parseCsv(text: string, mapping?: ColumnMap): ParsedSheet | ParseError {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  return rowsFromTable(result.data, mapping);
}

export function parseXlsx(data: ArrayBuffer | Uint8Array, mapping?: ColumnMap): ParsedSheet | ParseError {
  const wb = XLSX.read(data, { type: "array", cellDates: false, cellFormula: false, cellHTML: false });
  const first = wb.SheetNames[0];
  if (!first) return { code: "EMPTY", message: "The workbook has no sheets." };
  const table = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first], { header: 1, raw: false, defval: "" });
  return rowsFromTable(table, mapping);
}

export function isParseError(x: ParsedSheet | ParseError): x is ParseError {
  return "code" in x;
}
