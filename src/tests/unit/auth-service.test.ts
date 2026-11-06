// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createJsonMockRepository } from "@/lib/repo/json-mock";
import { buildSeed } from "@/data/seed";
import { DEMO_PASSWORD } from "@/data/seed/people";
import { authStore, resetAuthStore } from "@/lib/auth/store";
import {
  acceptInvite,
  forgotPassword,
  resetPassword,
  signIn,
  signUp,
  startInvite,
  verifyEmail,
  verifyTwoFactor,
  type RequestContext,
} from "@/lib/auth/service";
import { signToken } from "@/lib/auth/tokens";
import { authSecret } from "@/lib/auth/secret";
import type { Repository } from "@/lib/repo/interfaces";

const seed = buildSeed();
let repo: Repository;
let n = 0;
const ctx = (): RequestContext => ({
  ip: `10.0.0.${++n}`,
  deviceId: null,
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/140",
});
const login = (email: string, tab: "member" | "volunteer" | "admin" = "member", password = DEMO_PASSWORD) =>
  signIn(repo, { email, password, tab, remember: false }, ctx());
const linkIn = (kind: string) =>
  authStore()
    .outbox.find((e) => e.kind === kind)!
    .text.match(/https?:\/\/\S+/)![0];

beforeEach(() => {
  repo = createJsonMockRepository(seed);
  resetAuthStore();
});

describe("sign in", () => {
  it("signs members and volunteers straight in and sends them home", async () => {
    expect(await login("member@hod-demo.example.com")).toMatchObject({ ok: true, kind: "SIGNED_IN", next: "/member" });
    expect(await login("volunteer@hod-demo.example.com", "volunteer")).toMatchObject({ ok: true, next: "/volunteer" });
  });

  it("puts titles in the session claims and emails about a new device once", async () => {
    const r = await login("volunteer@hod-demo.example.com", "volunteer");
    if (!r.ok || r.kind !== "SIGNED_IN") throw new Error("expected sign-in");
    expect(r.claims.ttl.sort()).toEqual(["MARSHAL", "TEAM_LEAD"]);
    expect(authStore().outbox.filter((e) => e.kind === "NEW_DEVICE")).toHaveLength(1);
    await signIn(
      repo,
      { email: "volunteer@hod-demo.example.com", password: DEMO_PASSWORD, tab: "volunteer", remember: false },
      { ...ctx(), deviceId: r.deviceId },
    );
    expect(authStore().outbox.filter((e) => e.kind === "NEW_DEVICE")).toHaveLength(1);
  });

  it("follows a safe next link only when the person may open it", async () => {
    const ok = await signIn(
      repo,
      {
        email: "member@hod-demo.example.com",
        password: DEMO_PASSWORD,
        tab: "member",
        remember: false,
        next: "/member/attendance",
      },
      ctx(),
    );
    expect(ok).toMatchObject({ next: "/member/attendance" });
    const blocked = await signIn(
      repo,
      {
        email: "member@hod-demo.example.com",
        password: DEMO_PASSWORD,
        tab: "member",
        remember: false,
        next: "/admin/settings",
      },
      ctx(),
    );
    expect(blocked).toMatchObject({ next: "/member" });
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const a = await login("nobody@example.com");
    const b = await login("member@hod-demo.example.com", "member", "WrongPassword1!");
    expect(a).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(b).toEqual(a);
  });

  it("tells pending, unverified and suspended people what is happening (only after the right password)", async () => {
    expect(await login("pending@hod-demo.example.com")).toMatchObject({ ok: false, code: "PENDING_APPROVAL" });
    const unverified = seed.users.find((u) => u.status === "PENDING" && !u.emailVerifiedAt)!;
    expect(await login(unverified.email, "volunteer")).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });
    expect(await login("suspended@hod-demo.example.com")).toMatchObject({ ok: false, code: "SUSPENDED" });
    expect(await login("suspended@hod-demo.example.com", "member", "nope-nope-nope")).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("shows a polite message to rejected applicants", async () => {
    const u = seed.users.find((x) => x.status === "PENDING" && x.emailVerifiedAt && x.id !== seed.demo.samuel)!;
    await repo.users.update(u.id, { status: "REMOVED", statusReason: "Rejected: could not confirm membership" });
    expect(await login(u.email)).toMatchObject({ ok: false, code: "REJECTED" });
  });

  it("checks the tab against the account", async () => {
    expect(await login("member@hod-demo.example.com", "admin")).toMatchObject({ code: "WRONG_TAB" });
    expect(await login("admin@hod-demo.example.com", "member")).toMatchObject({ code: "WRONG_TAB" });
    expect(await login("member@hod-demo.example.com", "volunteer")).toMatchObject({ code: "WRONG_TAB" });
  });

  it("locks the account for 15 minutes after 5 failures, even with the right password", async () => {
    for (let i = 0; i < 4; i++)
      expect(await login("ngozi-typo@example.com", "member", "x")).toMatchObject({ code: "INVALID_CREDENTIALS" });
    for (let i = 0; i < 4; i++) await login("gold@hod-demo.example.com", "member", "wrong-password-1");
    expect(await login("gold@hod-demo.example.com", "member", "wrong-password-1")).toMatchObject({ code: "LOCKED" });
    const r = await login("gold@hod-demo.example.com");
    expect(r).toMatchObject({ ok: false, code: "LOCKED" });
    if (!r.ok) expect(r.message).toMatch(/15 minutes/);
  });
});

describe("admin two-factor", () => {
  it("requires a code; demo mode accepts any six digits", async () => {
    const step = await login("admin@hod-demo.example.com", "admin");
    if (!step.ok || step.kind !== "TWO_FACTOR") throw new Error("expected two-factor step");
    const pending = await signToken(step.pending, authSecret());
    expect(await verifyTwoFactor(repo, pending, "12345", null, ctx())).toMatchObject({ code: "INVALID_CODE" });
    expect(await verifyTwoFactor(repo, pending, "123456", null, ctx())).toMatchObject({ ok: true, next: "/admin" });
    expect(await verifyTwoFactor(repo, undefined, "123456", null, ctx())).toMatchObject({ code: "EXPIRED" });
  });
});

describe("sign up and email verification", () => {
  const body = {
    role: "VOLUNTEER" as const,
    name: "Amaka Nwosu",
    email: "amaka.new@example.com",
    phone: "+44 7700 900123",
    password: "Serve-With-Excellence-2026",
    country: "United Kingdom",
    city: "Leeds",
    language: "en" as const,
    unitCode: "",
    consentLocation: true as const,
    consentReminders: true as const,
    zones: ["Kitchen"],
    availability: ["Saturday mornings"],
    notes: "",
  };

  it("creates a pending, unverified account, emails a link, and verification leads to Pending", async () => {
    expect(await signUp(repo, body, ctx())).toEqual({ ok: true });
    const u = (await repo.users.findFirst({ email: "amaka.new@example.com" }))!;
    expect(u).toMatchObject({ status: "PENDING", role: "VOLUNTEER", timezone: "Europe/London", emailVerifiedAt: null });
    expect(u.passwordHash).toMatch(/^scrypt\$/);
    expect(u.signupDetails).toMatchObject({ zones: ["Kitchen"], availability: ["Saturday mornings"] });
    expect(await login("amaka.new@example.com", "volunteer", body.password)).toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });

    const token = new URL(linkIn("VERIFY_EMAIL")).searchParams.get("token")!;
    expect(await verifyEmail(repo, token)).toEqual({ ok: true, status: "PENDING" });
    expect((await repo.users.get(u.id))!.emailVerifiedAt).not.toBeNull();
    expect(await login("amaka.new@example.com", "volunteer", body.password)).toMatchObject({
      code: "PENDING_APPROVAL",
    });
    expect(await repo.audit.count({ where: { action: "USER_SIGNED_UP" } })).toBe(1);
  });

  it("does not reveal that an email is registered", async () => {
    expect(await signUp(repo, { ...body, email: "member@hod-demo.example.com" }, ctx())).toEqual({ ok: true });
    expect(authStore().outbox[0]).toMatchObject({ kind: "ACCOUNT_EXISTS", to: "member@hod-demo.example.com" });
    expect(await repo.users.count({ where: { email: "member@hod-demo.example.com" } })).toBe(1);
  });

  it("rejects a bad verification token", async () => {
    expect(await verifyEmail(repo, "not-a-real-token-value")).toMatchObject({ ok: false, code: "INVALID_TOKEN" });
  });
});

describe("password reset", () => {
  it("emails a one-time link that changes the password", async () => {
    const email = seed.users.find((u) => u.id === "usr-g10")!.email;
    expect(await forgotPassword(repo, email, ctx())).toEqual({ ok: true });
    const token = linkIn("PASSWORD_RESET").split("/reset-password/")[1];
    expect(await resetPassword(repo, token, "A-Brand-New-Password-9", ctx())).toEqual({ ok: true });
    expect(await login(email, "member", "A-Brand-New-Password-9")).toMatchObject({ ok: true });
    expect(await login(email)).toMatchObject({ code: "INVALID_CREDENTIALS" });
    // Used once: the fingerprint no longer matches.
    expect(await resetPassword(repo, token, "Another-New-Password-9", ctx())).toMatchObject({ code: "ALREADY_USED" });
  });

  it("answers the same for unknown emails and sends nothing", async () => {
    expect(await forgotPassword(repo, "ghost@example.com", ctx())).toEqual({ ok: true });
    expect(authStore().outbox).toHaveLength(0);
  });
});

describe("admin invitations", () => {
  it("accepts a valid invite once, creating an active admin with two-factor", async () => {
    const start = await startInvite(repo, "demo-invite-2026");
    if (!start.ok) throw new Error(start.message);
    expect(start).toMatchObject({ email: "new.comms@example.com", level: "COMMS_OFFICER" });
    const r = await acceptInvite(
      repo,
      {
        token: "demo-invite-2026",
        name: "Bisi Adewale",
        password: "Serve-With-Excellence-2026",
        secret: start.secret,
        code: "654321",
      },
      ctx(),
    );
    expect(r).toMatchObject({ ok: true, next: "/admin" });
    const u = (await repo.users.findFirst({ email: "new.comms@example.com" }))!;
    expect(u).toMatchObject({ role: "ADMIN", adminLevel: "COMMS_OFFICER", status: "ACTIVE", totpSecret: start.secret });
    expect(await startInvite(repo, "demo-invite-2026")).toMatchObject({ ok: false, code: "ALREADY_USED" });
  });

  it("refuses expired and unknown invites", async () => {
    expect(await startInvite(repo, "demo-invite-expired")).toMatchObject({ ok: false, code: "EXPIRED" });
    expect(await startInvite(repo, "made-up-token")).toMatchObject({ ok: false, code: "INVALID_TOKEN" });
  });
});
