import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { importMembers } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { importBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/members/import: preview (commit false) or import (commit true) a CSV. */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, importBody);
  if (!body.ok) return body.res;
  return respond(await importMembers(repo(), auth.ctx, body.data.csv, body.data.commit), body.data.commit ? 201 : 200);
}
