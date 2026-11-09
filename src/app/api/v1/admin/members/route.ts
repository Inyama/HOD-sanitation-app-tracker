import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf, respond } from "@/lib/admin/api";
import { loadMemberRows } from "@/lib/admin/data";
import { filterMembers, paginate, sortMembers } from "@/lib/admin/members";
import { addMember } from "@/lib/admin/service";
import { apiError, parseJson } from "@/lib/http";
import { addMemberBody, memberListQuery } from "@/lib/validation/admin";

/** GET /api/v1/admin/members: search, filter, sort and page the directory. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "people.view");
  if (!auth.ok) return auth.res;
  const parsed = memberListQuery.safeParse(queryOf(req));
  if (!parsed.success) return apiError("BAD_REQUEST", "Some filters are not valid.", 400);
  const q = parsed.data;
  const rows = sortMembers(
    filterMembers(await loadMemberRows(repo(), auth.ctx.now), q),
    q.sort ?? "name",
    q.dir ?? "asc",
  );
  return NextResponse.json(paginate(rows, q.page, q.pageSize), { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/v1/admin/members: add a person; they get a welcome email to choose a password. */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "people.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, addMemberBody);
  if (!body.ok) return body.res;
  return respond(await addMember(repo(), auth.ctx, body.data), 201);
}
