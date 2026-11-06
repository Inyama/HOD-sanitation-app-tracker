/**
 * CSV export (spec 12): every cell that starts with =, +, - or @ (or a tab or carriage return)
 * is prefixed with an apostrophe so spreadsheet apps never run it as a formula.
 */

const DANGEROUS = /^[=+\-@\t\r]/;

export function neutralizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return DANGEROUS.test(s) ? `'${s}` : s;
}

function quote(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** RFC 4180 CSV with CRLF line endings and a UTF-8 byte order mark so Excel reads accents correctly. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => quote(neutralizeCell(c.header))).join(",")];
  for (const row of rows) lines.push(columns.map((c) => quote(neutralizeCell(c.value(row)))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
