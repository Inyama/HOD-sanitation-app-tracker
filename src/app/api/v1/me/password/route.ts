import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { repo } from "@/lib/repo";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { passwordChange } from "@/lib/validation/member";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { accountEmail } from "@/lib/notifications/account-emails";
import { sendBrandedEmail } from "@/lib/notifications/senders";
import { formatShort } from "@/lib/time/zone";

/** POST /api/v1/me/password: change my password (current password required). */
export async function POST(req: NextRequest) {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, passwordChange);
  if (!body.ok) return body.res;
  const u = auth.current.user;
  if (!(await verifyPassword(body.data.current, u.passwordHash))) {
    return apiError("VALIDATION_FAILED", "Your current password is not right.", 422, {
      fields: { current: "Your current password is not right." },
    });
  }
  await repo().users.update(u.id, { passwordHash: await hashPassword(body.data.next) });
  await sendBrandedEmail(
    u.email,
    "PASSWORD_CHANGED",
    accountEmail("PASSWORD_CHANGED", { name: u.name, when: formatShort(DateTime.now(), u.timezone) }),
  );
  return NextResponse.json({ ok: true });
}
