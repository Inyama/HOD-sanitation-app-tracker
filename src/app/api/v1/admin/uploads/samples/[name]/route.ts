import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { adminRequest } from "@/lib/admin/api";
import { apiError } from "@/lib/http";

/** The downloadable template and sample sheets (spec 6.4, 10.5). Only these names are served. */
const FILES: Record<string, string> = {
  "attendance-template.csv": "text/csv; charset=utf-8",
  "thursday-clean.csv": "text/csv; charset=utf-8",
  "thursday-with-errors.csv": "text/csv; charset=utf-8",
  "thursday-with-errors.xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** GET /api/v1/admin/uploads/samples/:name */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/v1/admin/uploads/samples/[name]">) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const { name } = await params;
  const type = FILES[name];
  if (!type) return apiError("NOT_FOUND", "No such sample.", 404);
  const data = await readFile(path.join(process.cwd(), "src", "data", "sample-sheets", name));
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
