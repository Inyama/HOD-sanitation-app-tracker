import type { NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, respond } from "@/lib/admin/api";
import { addNote } from "@/lib/admin/service";
import { parseJson } from "@/lib/http";
import { noteBody } from "@/lib/validation/admin";

/** POST /api/v1/admin/members/:id/notes: a private admin note on the profile. */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/v1/admin/members/[id]/notes">) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, noteBody);
  if (!body.ok) return body.res;
  return respond(await addNote(repo(), auth.ctx, (await params).id, body.data.body), 201);
}
