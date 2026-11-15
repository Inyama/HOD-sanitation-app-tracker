import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { createPreview, uploadHistory } from "@/lib/admin/ops-uploads";
import { parseJson } from "@/lib/http";
import { createUploadBody } from "@/lib/validation/ops";

/** GET /api/v1/admin/uploads: upload history (newest first). */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  return NextResponse.json(
    { ok: true, uploads: await uploadHistory(repo()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/v1/admin/uploads: parse and match a sheet for a meeting; stores a Preview (spec 6.4). */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "uploads.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, createUploadBody);
  if (!body.ok) return body.res;
  return respond(await createPreview(repo(), auth.ctx, body.data), 201);
}
