import { NextResponse } from "next/server";
import { SESSION_COOKIE, TWO_FACTOR_COOKIE } from "@/lib/auth/claims";

/** POST /api/v1/auth/logout: clears the session. The device cookie stays so it is not "new" next time. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(TWO_FACTOR_COOKIE);
  return res;
}
