import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/auth/session";
import { apiError, parseJson } from "@/lib/http";
import { swapDecision } from "@/lib/validation/volunteer";
import { decideSwap } from "@/lib/volunteer/service";

/** POST /api/v1/duties/:id/swap/decision: Team Lead or admin approves or declines a swap. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current) return apiError("UNAUTHENTICATED", "Please sign in.", 401);
  const body = await parseJson(req, swapDecision);
  if (!body.ok) return body.res;
  const { id } = await params;
  const result = await decideSwap(repo(), current.user, id, body.data.approve);
  if (!result.ok) return apiError(result.code, result.message, result.status);
  return NextResponse.json(result);
}
