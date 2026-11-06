import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { forgotPassword } from "@/lib/auth/service";
import { forgotBody } from "@/lib/validation/auth";
import { failureResponse, parseJson, requestContext } from "@/lib/http";

/** POST /api/v1/auth/forgot: always answers the same way, whether or not the email exists. */
export async function POST(req: NextRequest) {
  const body = await parseJson(req, forgotBody);
  if (!body.ok) return body.res;
  const result = await forgotPassword(repo(), body.data.email, requestContext(req));
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true });
}
