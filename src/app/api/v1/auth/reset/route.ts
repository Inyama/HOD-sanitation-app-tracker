import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { checkResetToken, resetPassword } from "@/lib/auth/service";
import { resetBody } from "@/lib/validation/auth";
import { apiError, failureResponse, parseJson, requestContext } from "@/lib/http";

/** GET /api/v1/auth/reset?token= checks a link before showing the form. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return apiError("INVALID_TOKEN", "Missing reset token.", 400);
  const result = await checkResetToken(repo(), token);
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true, email: result.user.email.replace(/^(.).*(@.*)$/, "$1•••$2") });
}

/** POST /api/v1/auth/reset: sets the new password; the link stops working afterwards. */
export async function POST(req: NextRequest) {
  const body = await parseJson(req, resetBody);
  if (!body.ok) return body.res;
  const result = await resetPassword(repo(), body.data.token, body.data.password, requestContext(req));
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
