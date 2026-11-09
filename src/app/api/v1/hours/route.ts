import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { manualHours } from "@/lib/validation/volunteer";
import { addManualHours } from "@/lib/volunteer/service";
import { summarizeHours } from "@/lib/volunteer/hours";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** GET /api/v1/hours: my service hours with totals. */
export async function GET(req: NextRequest) {
  const auth = await apiUser("volunteer.hours");
  if (!auth.ok) return auth.res;
  const items = await repo().serviceHours.list({
    where: { userId: auth.current.user.id },
    orderBy: { field: "createdAt", dir: "desc" },
  });
  return NextResponse.json({
    items,
    summary: summarizeHours(items, nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value)),
  });
}

/** POST /api/v1/hours: log manual hours; they wait for an admin to verify them. */
export async function POST(req: NextRequest) {
  const auth = await apiUser("volunteer.hours");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, manualHours);
  if (!body.ok) return body.res;
  const result = await addManualHours(
    repo(),
    auth.current.user,
    body.data,
    nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
  );
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return NextResponse.json(result, { status: 201 });
}
