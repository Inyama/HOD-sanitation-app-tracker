import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { authStore } from "@/lib/auth/store";
import { apiError, parseJson } from "@/lib/http";
import { issueReport } from "@/lib/validation/volunteer";
import { reportIssue } from "@/lib/volunteer/service";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/issues: issues I reported, newest first. */
export async function GET() {
  const auth = await apiUser("volunteer.issues");
  if (!auth.ok) return auth.res;
  const items = await repo().issues.list({
    where: { reporterId: auth.current.user.id },
    orderBy: { field: "createdAt", dir: "desc" },
  });
  return NextResponse.json({ items });
}

/** POST /api/v1/issues: report a problem with an optional photo. */
export async function POST(req: NextRequest) {
  const auth = await apiUser("volunteer.issues");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, issueReport);
  if (!body.ok) return body.res;
  if (
    body.data.photoUrl &&
    authStore().files.get(body.data.photoUrl.split("/").pop()!)?.ownerId !== auth.current.user.id
  ) {
    return apiError("BAD_PHOTO", "Upload the photo again.", 422);
  }
  const result = await reportIssue(
    repo(),
    auth.current.user,
    { area: body.data.area, urgency: body.data.urgency, note: body.data.note, photoUrl: body.data.photoUrl ?? null },
    nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
  );
  return NextResponse.json(result, { status: 201 });
}
