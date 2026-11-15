import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { adminRequest, queryOf, respond } from "@/lib/admin/api";
import { createMeetings, loadMeetingsScreen } from "@/lib/admin/ops-meetings";
import { apiError, parseJson } from "@/lib/http";
import { meetingBody, meetingsQuery } from "@/lib/validation/ops";

/** GET /api/v1/admin/meetings?month=yyyy-MM: month calendar, upcoming and recent meetings. */
export async function GET(req: NextRequest) {
  const auth = await adminRequest(req, "meetings.manage");
  if (!auth.ok) return auth.res;
  const q = meetingsQuery.safeParse(queryOf(req));
  if (!q.success) return apiError("VALIDATION_FAILED", "Use month=yyyy-MM.", 422);
  const data = await loadMeetingsScreen(repo(), auth.ctx.now, q.data.month);
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/v1/admin/meetings: create a meeting or event (optionally weekly for up to 12 weeks). */
export async function POST(req: NextRequest) {
  const auth = await adminRequest(req, "meetings.manage");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, meetingBody);
  if (!body.ok) return body.res;
  return respond(await createMeetings(repo(), auth.ctx, body.data), 201);
}
