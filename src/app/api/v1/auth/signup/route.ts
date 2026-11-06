import { NextResponse, type NextRequest } from "next/server";
import { repo } from "@/lib/repo";
import { signUp } from "@/lib/auth/service";
import { signupBody } from "@/lib/validation/auth";
import { failureResponse, parseJson, requestContext } from "@/lib/http";

/** POST /api/v1/auth/signup: member or volunteer sign-up; the account starts Pending. */
export async function POST(req: NextRequest) {
  const body = await parseJson(req, signupBody);
  if (!body.ok) return body.res;
  const result = await signUp(repo(), body.data, requestContext(req));
  if (!result.ok) return failureResponse(result);
  return NextResponse.json({ ok: true }, { status: 201 });
}
