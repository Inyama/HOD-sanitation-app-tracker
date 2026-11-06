import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { resendVerification, verifyEmail } from "@/lib/auth/service";
import { verifyEmailBody } from "@/lib/validation/auth";
import { failureResponse, parseJson, requestContext } from "@/lib/http";

/** POST /api/v1/auth/verify-email: { token } confirms the email; { resendFor } sends a new link. */
export async function POST(req: NextRequest) {
  const body = await parseJson(req, verifyEmailBody);
  if (!body.ok) return body.res;
  if ("token" in body.data) {
    const result = await verifyEmail(repo(), body.data.token);
    if (!result.ok) return failureResponse(result);
    return NextResponse.json({ ok: true, status: result.status });
  }
  const result = await resendVerification(repo(), body.data.resendFor, requestContext(req));
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
