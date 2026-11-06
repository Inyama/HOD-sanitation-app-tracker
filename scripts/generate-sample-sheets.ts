/**
 * Writes the downloadable sample sheets (spec 6.4, 10.5) from the deterministic seed:
 *   attendance-template.csv      headers only
 *   thursday-clean.csv           Thursday 5 Nov 2026 attendees, all correct
 *   thursday-with-errors.csv     same plus 3 deliberate errors (misspelled name, unknown email, duplicate row)
 *   thursday-with-errors.xlsx    the same as an Excel workbook
 * Run: npm run seed:sheets
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { buildSeed } from "@/data/seed";
import type { SheetRow } from "@/lib/matching/matchSheet";

const OUT = join(process.cwd(), "src", "data", "sample-sheets");
const HEADERS = ["Full Name", "E-mail", "Phone", "Check-in Time"];
const toTable = (rows: SheetRow[]) => rows.map((r) => [r.name, r.email ?? "", r.phone ?? "", r.time ?? ""]);

const { sampleSheets } = buildSeed();
writeFileSync(join(OUT, "attendance-template.csv"), Papa.unparse([HEADERS]) + "\r\n");
writeFileSync(join(OUT, "thursday-clean.csv"), Papa.unparse([HEADERS, ...toTable(sampleSheets.clean)]) + "\r\n");
writeFileSync(
  join(OUT, "thursday-with-errors.csv"),
  Papa.unparse([HEADERS, ...toTable(sampleSheets.withErrors)]) + "\r\n",
);

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...toTable(sampleSheets.withErrors)]);
ws["!cols"] = [{ wch: 26 }, { wch: 36 }, { wch: 18 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, ws, "Thursday 5 Nov 2026");
writeFileSync(join(OUT, "thursday-with-errors.xlsx"), XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

console.log(
  `Wrote 4 files to ${OUT}: clean ${sampleSheets.clean.length} rows, with errors ${sampleSheets.withErrors.length} rows.`,
);
