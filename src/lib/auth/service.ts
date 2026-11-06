import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { User } from "@/lib/repo/types";
import { ADMIN_LEVEL_LABELS, DEFAULT_NOTIF_PREFS } from "@/lib/repo/types";
import { isDemoMode } from "@/lib/env";
import { nowMs } from "@/lib/time/clock";
import { formatShort } from "@/lib/time/zone";
import { accountEmail } from "@/lib/notifications/account-emails";
import { appUrl, sendBrandedEmail } from "@/lib/notifications/senders";
import type { SignupBody, LoginTab } from "@/lib/validation/auth";
import { authStore } from "./store";
import { authSecret } from "./secret";
import { hashPassword, passwordFingerprint, verifyPassword } from "./password";
import { lockoutState, minutesText, RATE_LIMITS, slidingWindow } from "./limits";
import { randomToken, sha256Hex, signToken, verifyToken } from "./tokens";
import { canAccessPath } from "./permissions";
import {
  homeFor,
  newSessionClaims,
  safeNext,
  TWO_FACTOR_TTL_MS,
  type SessionClaims,
  type TwoFactorClaims,
} from "./claims";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

/**
 * Account flows (spec 4.3). Route handlers translate these results to HTTP and cookies.
 * Error messages are specific but safe: an unknown email and a wrong password look the same.
 */

export interface RequestContext {
  ip: string;
  deviceId: string | null;
  userAgent: string | null;
}

export type AuthError =
  | "INVALID_CREDENTIALS"
  | "PENDING_APPROVAL"
  | "EMAIL_NOT_VERIFIED"
  | "SUSPENDED"
  | "REJECTED"
  | "LOCKED"
  | "RATE_LIMITED"
  | "WRONG_TAB"
  | "INVALID_CODE"
  | "INVALID_TOKEN"
  | "EXPIRED"
  | "ALREADY_USED"
  | "EMAIL_IN_USE";

export interface Failure {
  ok: false;
  code: AuthError;
  message: string;
  retryAfterMs?: number;
}

const fail = (code: AuthError, message: string, retryAfterMs?: number): Failure => ({
  ok: false,
  code,
  message,
  retryAfterMs,
});

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const DEVICE_LIMIT = 20;

function rateLimit(key: keyof typeof RATE_LIMITS, ip: string): Failure | null {
  const store = authStore();
  const id = `${key}:${ip}`;
  const r = slidingWindow(store.rate.get(id) ?? [], nowMs(), RATE_LIMITS[key].limit, RATE_LIMITS[key].windowMs);
  store.rate.set(id, r.hits);
  return r.allowed
    ? null
    : fail(
        "RATE_LIMITED",
        `Too many attempts. Please wait ${minutesText(r.retryAfterMs)} and try again.`,
        r.retryAfterMs,
      );
}

function lockedFailure(email: string): Failure | null {
  const st = lockoutState(authStore().failures.get(email) ?? [], nowMs());
  authStore().failures.set(email, st.failures);
  return st.locked
    ? fail(
        "LOCKED",
        `Too many failed attempts. For your security, sign-in is paused for ${minutesText(st.retryAfterMs)}.`,
        st.retryAfterMs,
      )
    : null;
}

function recordFailure(email: string): Failure {
  const store = authStore();
  store.failures.set(email, [...(store.failures.get(email) ?? []), nowMs()]);
  return (
    lockedFailure(email) ??
    fail("INVALID_CREDENTIALS", "That email and password do not match. Check them and try again.")
  );
}

const TIMEZONES: Record<string, string> = {
  Nigeria: "Africa/Lagos",
  Ghana: "Africa/Accra",
  "United Kingdom": "Europe/London",
  "United States": "America/New_York",
  Canada: "America/Toronto",
  "South Africa": "Africa/Johannesburg",
  Kenya: "Africa/Nairobi",
  Ireland: "Europe/Dublin",
  Germany: "Europe/Berlin",
  "United Arab Emirates": "Asia/Dubai",
};

function describeDevice(ua: string | null): string {
  if (!ua) return "an unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "a browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown system";
  return `${browser} on ${os}`;
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

export interface SignedIn {
  ok: true;
  kind: "SIGNED_IN";
  claims: SessionClaims;
  deviceId: string;
  next: string;
}

export interface NeedsTwoFactor {
  ok: true;
  kind: "TWO_FACTOR";
  pending: TwoFactorClaims;
  next: string | null;
}

async function completeSignIn(
  repo: Repository,
  user: User,
  remember: boolean,
  next: string | null,
  ctx: RequestContext,
): Promise<SignedIn> {
  const titles = (await repo.userTitles.list({ where: { userId: user.id } })).map((t) => t.title);
  const now = nowMs();
  await repo.users.update(user.id, { lastLoginAt: new Date(now).toISOString() });

  // New-device sign-in sends an email (spec 4.3).
  const store = authStore();
  const deviceId = ctx.deviceId && /^[A-Za-z0-9_-]{16,64}$/.test(ctx.deviceId) ? ctx.deviceId : randomToken(18);
  const known = store.devices.get(user.id) ?? new Set<string>();
  if (!known.has(deviceId)) {
    known.add(deviceId);
    if (known.size > DEVICE_LIMIT) known.delete(known.values().next().value!);
    store.devices.set(user.id, known);
    await sendBrandedEmail(
      user.email,
      "NEW_DEVICE",
      accountEmail("NEW_DEVICE", {
        name: user.name,
        device: describeDevice(ctx.userAgent),
        when: `${formatShort(DateTime.fromMillis(now), user.timezone)} (${user.timezone.replace("_", " ")})`,
        url: `${appUrl()}/forgot-password`,
      }),
    );
  }

  const claims = newSessionClaims(user, titles, remember, now);
  const actor = { role: user.role, adminLevel: user.adminLevel, status: user.status, titles };
  const wanted = safeNext(next);
  return {
    ok: true,
    kind: "SIGNED_IN",
    claims,
    deviceId,
    next: wanted && canAccessPath(actor, wanted) ? wanted : homeFor(user.role),
  };
}

export async function signIn(
  repo: Repository,
  input: { email: string; password: string; tab: LoginTab; remember: boolean; next?: string },
  ctx: RequestContext,
): Promise<SignedIn | NeedsTwoFactor | Failure> {
  const limited = rateLimit("login", ctx.ip);
  if (limited) return limited;
  const email = input.email.trim().toLowerCase();
  const locked = lockedFailure(email);
  if (locked) return locked;

  const user = await repo.users.findFirst({ email });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) return recordFailure(email);
  authStore().failures.delete(email);

  if (user.status === "PENDING") {
    return user.emailVerifiedAt
      ? fail(
          "PENDING_APPROVAL",
          "Your account is waiting for approval by a unit admin. We will email you as soon as it is approved.",
        )
      : fail("EMAIL_NOT_VERIFIED", "Please confirm your email first. We can send the link again.");
  }
  if (user.status === "SUSPENDED")
    return fail("SUSPENDED", "This account is suspended. Please contact a unit admin if you think this is a mistake.");
  if (user.status === "REMOVED") {
    return user.statusReason?.startsWith("Rejected")
      ? fail(
          "REJECTED",
          "Your request to join was not approved this time. Please contact the unit if you would like to talk about it.",
        )
      : fail("INVALID_CREDENTIALS", "That email and password do not match. Check them and try again.");
  }

  if (input.tab === "admin" && user.role !== "ADMIN")
    return fail("WRONG_TAB", "This is not an admin account. Use the Member or Volunteer tab.");
  if (input.tab !== "admin" && user.role === "ADMIN")
    return fail("WRONG_TAB", "Admins sign in on the Admin tab, which adds a two-factor code.");
  if (input.tab === "volunteer" && user.role !== "VOLUNTEER")
    return fail("WRONG_TAB", "This is a member account. Use the Member tab, or sign up as a volunteer.");

  if (user.role === "ADMIN") {
    return {
      ok: true,
      kind: "TWO_FACTOR",
      pending: { typ: "2fa", sub: user.id, exp: nowMs() + TWO_FACTOR_TTL_MS, rem: input.remember },
      next: input.next ?? null,
    };
  }
  return completeSignIn(repo, user, input.remember, input.next ?? null, ctx);
}

export async function verifyTwoFactor(
  repo: Repository,
  pendingToken: string | undefined,
  code: string,
  next: string | null,
  ctx: RequestContext,
): Promise<SignedIn | Failure> {
  const limited = rateLimit("twoFactor", ctx.ip);
  if (limited) return limited;
  const pending = await verifyToken<TwoFactorClaims>(pendingToken, authSecret(), "2fa", nowMs());
  if (!pending) return fail("EXPIRED", "Your sign-in step expired. Please enter your email and password again.");
  const user = await repo.users.get(pending.sub);
  if (!user || user.status !== "ACTIVE" || user.role !== "ADMIN")
    return fail("INVALID_CREDENTIALS", "Please sign in again.");
  const locked = lockedFailure(user.email);
  if (locked) return locked;
  // Demo mode accepts any six digits (spec 4.3); otherwise the code must match the admin's secret.
  const valid = isDemoMode() ? /^\d{6}$/.test(code) : !!user.totpSecret && verifyTotp(user.totpSecret, code, nowMs());
  if (!valid) {
    const f = recordFailure(user.email);
    return f.code === "LOCKED"
      ? f
      : fail("INVALID_CODE", "That code is not right. Check your authenticator app and try again.");
  }
  authStore().failures.delete(user.email);
  return completeSignIn(repo, user, pending.rem, next, ctx);
}

// ---------------------------------------------------------------------------
// Sign up and email verification
// ---------------------------------------------------------------------------

async function sendVerification(user: User) {
  const token = await signToken({ typ: "verify", sub: user.id, exp: nowMs() + VERIFY_TTL_MS }, authSecret());
  await sendBrandedEmail(
    user.email,
    "VERIFY_EMAIL",
    accountEmail("VERIFY_EMAIL", { name: user.name, url: `${appUrl()}/verify-email?token=${token}` }),
  );
}

/**
 * Creates a Pending account and emails a verification link. To avoid revealing which emails
 * are registered, an existing address gets an "you already have an account" email instead and
 * the response is the same.
 */
export async function signUp(repo: Repository, body: SignupBody, ctx: RequestContext): Promise<{ ok: true } | Failure> {
  const limited = rateLimit("signup", ctx.ip);
  if (limited) return limited;
  const email = body.email.trim().toLowerCase();
  const existing = await repo.users.findFirst({ email });
  if (existing) {
    await sendBrandedEmail(email, "ACCOUNT_EXISTS", {
      subject: "You already have an account",
      preheader: "Someone tried to sign up with your email.",
      heading: "You already have an account",
      paragraphs: [
        `Hello ${existing.name.split(" ")[0]},`,
        "Someone (hopefully you) tried to sign up with this email. You already have an account, so you can sign in, or reset your password if you have forgotten it.",
      ],
      button: { label: "Reset my password", url: `${appUrl()}/forgot-password` },
    });
    return { ok: true };
  }
  const now = new Date(nowMs()).toISOString();
  const user = await repo.users.create({
    id: `usr-${randomToken(9)}`,
    name: body.name.replace(/\s+/g, " ").trim(),
    email,
    secondaryEmail: null,
    phone: body.phone.trim(),
    passwordHash: await hashPassword(body.password),
    role: body.role,
    adminLevel: null,
    status: "PENDING",
    isRemote: false,
    country: body.country,
    city: body.city,
    timezone: TIMEZONES[body.country] ?? "Africa/Lagos",
    language: body.language,
    avatarUrl: null,
    totpSecret: null,
    approvedAt: null,
    lastLoginAt: null,
    notifPrefs: { ...DEFAULT_NOTIF_PREFS },
    createdAt: now,
    statusChangedAt: null,
    statusReason: null,
    consentLocationAt: now,
    consentRemindersAt: now,
    emailVerifiedAt: null,
    signupDetails: {
      unitCode: body.unitCode || null,
      zones: body.role === "VOLUNTEER" ? (body.zones ?? []) : undefined,
      availability: body.role === "VOLUNTEER" ? (body.availability ?? []) : undefined,
      notes: body.notes || null,
    },
  });
  await repo.audit.append({
    actorId: user.id,
    action: "USER_SIGNED_UP",
    entity: "User",
    entityId: user.id,
    before: null,
    after: { role: user.role, status: user.status },
    ip: ctx.ip,
  });
  await sendVerification(user);
  return { ok: true };
}

export async function verifyEmail(
  repo: Repository,
  token: string,
): Promise<{ ok: true; status: User["status"] } | Failure> {
  const claims = await verifyToken<{ typ: "verify"; sub: string; exp: number }>(token, authSecret(), "verify", nowMs());
  if (!claims) return fail("INVALID_TOKEN", "This link has expired or is not valid. Ask for a new one below.");
  const user = await repo.users.get(claims.sub);
  if (!user) return fail("INVALID_TOKEN", "This link is not valid.");
  if (!user.emailVerifiedAt) {
    await repo.users.update(user.id, { emailVerifiedAt: new Date(nowMs()).toISOString() });
    await sendBrandedEmail(user.email, "SIGNUP_RECEIVED", accountEmail("SIGNUP_RECEIVED", { name: user.name }));
  }
  return { ok: true, status: user.status };
}

export async function resendVerification(
  repo: Repository,
  email: string,
  ctx: RequestContext,
): Promise<{ ok: true } | Failure> {
  const limited = rateLimit("signup", ctx.ip);
  if (limited) return limited;
  const user = await repo.users.findFirst({ email: email.trim().toLowerCase() });
  if (user && user.status === "PENDING" && !user.emailVerifiedAt) await sendVerification(user);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function forgotPassword(
  repo: Repository,
  email: string,
  ctx: RequestContext,
): Promise<{ ok: true } | Failure> {
  const limited = rateLimit("forgot", ctx.ip);
  if (limited) return limited;
  const user = await repo.users.findFirst({ email: email.trim().toLowerCase() });
  if (user && user.status !== "REMOVED") {
    const token = await signToken(
      { typ: "reset", sub: user.id, fp: passwordFingerprint(user.passwordHash), exp: nowMs() + RESET_TTL_MS },
      authSecret(),
    );
    await sendBrandedEmail(
      user.email,
      "PASSWORD_RESET",
      accountEmail("PASSWORD_RESET", { name: user.name, url: `${appUrl()}/reset-password/${token}` }),
    );
  }
  return { ok: true };
}

export async function checkResetToken(repo: Repository, token: string): Promise<{ ok: true; user: User } | Failure> {
  const claims = await verifyToken<{ typ: "reset"; sub: string; fp: string; exp: number }>(
    token,
    authSecret(),
    "reset",
    nowMs(),
  );
  if (!claims) return fail("INVALID_TOKEN", "This reset link has expired or is not valid. Ask for a new one.");
  const user = await repo.users.get(claims.sub);
  if (!user || passwordFingerprint(user.passwordHash) !== claims.fp)
    return fail("ALREADY_USED", "This reset link has already been used. Ask for a new one if you still need it.");
  return { ok: true, user };
}

export async function resetPassword(
  repo: Repository,
  token: string,
  password: string,
  ctx: RequestContext,
): Promise<{ ok: true } | Failure> {
  const check = await checkResetToken(repo, token);
  if (!check.ok) return check;
  const { user } = check;
  await repo.users.update(user.id, { passwordHash: await hashPassword(password) });
  authStore().failures.delete(user.email);
  await repo.audit.append({
    actorId: user.id,
    action: "PASSWORD_RESET",
    entity: "User",
    entityId: user.id,
    before: null,
    after: null,
    ip: ctx.ip,
  });
  await sendBrandedEmail(
    user.email,
    "PASSWORD_CHANGED",
    accountEmail("PASSWORD_CHANGED", {
      name: user.name,
      when: formatShort(DateTime.fromMillis(nowMs()), user.timezone),
    }),
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin invitations
// ---------------------------------------------------------------------------

export async function lookupInvite(repo: Repository, token: string) {
  const invite = await repo.invites.findFirst({ tokenHash: await sha256Hex(token) });
  if (!invite)
    return fail("INVALID_TOKEN", "This invitation link is not valid. Ask the Super Admin to send a new one.");
  if (invite.usedAt)
    return fail("ALREADY_USED", "This invitation has already been used. Sign in on the Admin tab instead.");
  if (DateTime.fromISO(invite.expiresAt).toMillis() <= nowMs())
    return fail("EXPIRED", "This invitation expired. Invitations last 7 days; ask the Super Admin for a new one.");
  return { ok: true as const, invite };
}

export async function startInvite(repo: Repository, token: string) {
  const found = await lookupInvite(repo, token);
  if (!found.ok) return found;
  const secret = generateTotpSecret();
  return {
    ok: true as const,
    email: found.invite.email,
    level: found.invite.adminLevel,
    levelLabel: ADMIN_LEVEL_LABELS[found.invite.adminLevel],
    secret,
    otpauth: otpauthUri(secret, found.invite.email),
    demo: isDemoMode(),
  };
}

export async function acceptInvite(
  repo: Repository,
  body: { token: string; name: string; password: string; secret: string; code: string },
  ctx: RequestContext,
): Promise<SignedIn | Failure> {
  const found = await lookupInvite(repo, body.token);
  if (!found.ok) return found;
  const valid = isDemoMode() ? /^\d{6}$/.test(body.code) : verifyTotp(body.secret, body.code, nowMs());
  if (!valid)
    return fail("INVALID_CODE", "That code is not right. Scan the QR code again and enter the current six-digit code.");
  if (await repo.users.findFirst({ email: found.invite.email }))
    return fail(
      "EMAIL_IN_USE",
      "An account already exists for this email. Ask the Super Admin to change its role instead.",
    );
  const now = new Date(nowMs()).toISOString();
  const user = await repo.users.create({
    id: `usr-${randomToken(9)}`,
    name: body.name.replace(/\s+/g, " ").trim(),
    email: found.invite.email,
    secondaryEmail: null,
    phone: null,
    passwordHash: await hashPassword(body.password),
    role: "ADMIN",
    adminLevel: found.invite.adminLevel,
    status: "ACTIVE",
    isRemote: false,
    country: "Nigeria",
    city: "Lagos",
    timezone: "Africa/Lagos",
    language: "en",
    avatarUrl: null,
    totpSecret: body.secret,
    approvedAt: now,
    lastLoginAt: null,
    notifPrefs: { ...DEFAULT_NOTIF_PREFS },
    createdAt: now,
    statusChangedAt: null,
    statusReason: null,
    consentLocationAt: now,
    consentRemindersAt: now,
    emailVerifiedAt: now,
    signupDetails: null,
  });
  await repo.invites.update(found.invite.id, { usedAt: now });
  await repo.audit.append({
    actorId: user.id,
    action: "INVITE_ACCEPTED",
    entity: "Invite",
    entityId: found.invite.id,
    before: null,
    after: { userId: user.id, adminLevel: user.adminLevel },
    ip: ctx.ip,
  });
  return completeSignIn(repo, user, false, "/admin", ctx);
}
