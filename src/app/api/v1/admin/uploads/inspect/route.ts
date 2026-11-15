import type { NextRequest } from "next/server";
import { adminRequest, respond } from "@/lib/admin/api";
import { inspectUpload } from "@/lib/admin/ops-uploads";
import { parseJson } from "@/lib/http";
import { inspectUploadBody } from "@/lib/validation/ops";

/** POST /api/v1/admin/uploads/inspect: headers, sample rows and detected columns, for the mapping step. */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, inspectUploadBody);
  if (!body.ok) return body.res;
  return respond(await inspectUpload(body.data.name, body.data.size, body.data.data));
}
