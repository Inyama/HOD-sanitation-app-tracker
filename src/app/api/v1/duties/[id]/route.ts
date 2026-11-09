import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError } from "@/lib/http";
import { withdrawFromDuty } from "@/lib/volunteer/service";
import { nowForRequest } from "@/lib/time/server-now";
import { CLOCK_COOKIE } from "@/lib/time/clock";

/** DELETE /api/v1/duties/:id: withdraw from my duty (until 12 hours before). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser("volunteer.duties");
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const result = await withdrawFromDuty(
    repo(),
    auth.current.user,
    id,
    nowForRequest(req.cookies.get(CLOCK_COOKIE)?.value),
  );
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return NextResponse.json(result);
}
