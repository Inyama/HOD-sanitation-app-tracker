// @vitest-environment node
import { describe, expect, it } from "vitest";
import { b64urlDecode, b64urlEncode, randomToken, sha256Hex, signToken, verifyToken } from "@/lib/auth/tokens";
import {
  ADMIN_IDLE_MS,
  areaDecision,
  areaOf,
  homeFor,
  MEMBER_SESSION_MS,
  newSessionClaims,
  safeNext,
  sessionState,
  shouldRefreshActivity,
} from "@/lib/auth/claims";
import { LOCKOUT_MS, lockoutState, slidingWindow } from "@/lib/auth/limits";
import { isAcceptablePassword, passwordStrength } from "@/lib/auth/strength";
import { base32Decode, base32Encode, hotp, otpauthUri, totp, verifyTotp } from "@/lib/auth/totp";
import { signupBody } from "@/lib/validation/auth";

const SECRET = "test-secret-that-is-long-enough-for-hmac-signing";

describe("signed tokens", () => {
  it("round-trips base64url", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect([...b64urlDecode(b64urlEncode(bytes))]).toEqual([...bytes]);
    expect(b64urlEncode(bytes)).not.toMatch(/[+/=]/);
  });

  it("verifies a valid token and rejects tampering, wrong purpose, wrong secret and expiry", async () => {
    const t = await signToken({ typ: "session", sub: "u1", exp: 2_000 }, SECRET);
    expect(await verifyToken(t, SECRET, "session", 1_000)).toMatchObject({ sub: "u1" });
    expect(await verifyToken(t, SECRET, "reset", 1_000)).toBeNull();
    expect(await verifyToken(t, "another-secret-that-is-also-long-enough", "session", 1_000)).toBeNull();
    expect(await verifyToken(t, SECRET, "session", 2_000)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "session", sub: "admin", exp: 9e15 })));
    expect(await verifyToken(`${forged}.${sig}`, SECRET, "session", 1_000)).toBeNull();
    expect(await verifyToken(`${body}.${sig}x`, SECRET, "session", 1_000)).toBeNull();
    expect(await verifyToken("garbage", SECRET, "session", 1_000)).toBeNull();
    expect(await verifyToken(undefined, SECRET, "session", 1_000)).toBeNull();
  });

  it("hashes invite tokens with SHA-256 and makes random tokens", async () => {
    expect(await sha256Hex("demo-invite-2026")).toBe(
      "294c351780c6e3e9172d24d95178ce9f66882c8a3dc6daea0962cb112a823c0a",
    );
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("session rules (spec 4.3)", () => {
  const member = { id: "m", role: "MEMBER" as const, adminLevel: null };
  const admin = { id: "a", role: "ADMIN" as const, adminLevel: "SUPER" as const };

  it("members last 30 days", () => {
    const c = newSessionClaims(member, [], true, 0);
    expect(c.exp).toBe(MEMBER_SESSION_MS);
    expect(sessionState(c, MEMBER_SESSION_MS - 1)).toBe("valid");
    expect(sessionState(c, MEMBER_SESSION_MS)).toBe("expired");
    // Inactivity never ends a member's session.
    expect(sessionState(c, ADMIN_IDLE_MS * 10)).toBe("valid");
  });

  it("admins are signed out after 8 hours without activity, and activity slides the window", () => {
    const c = newSessionClaims(admin, [], false, 0);
    expect(sessionState(c, ADMIN_IDLE_MS)).toBe("valid");
    expect(sessionState(c, ADMIN_IDLE_MS + 1)).toBe("idle");
    expect(shouldRefreshActivity(c, 4 * 60_000)).toBe(false);
    expect(shouldRefreshActivity(c, 6 * 60_000)).toBe(true);
    expect(sessionState({ ...c, act: 7 * 3600_000 }, 14 * 3600_000)).toBe("valid");
  });

  it("decides areas from the cookie: login, forbidden or allow", () => {
    const m = newSessionClaims(member, [], false, 0);
    const v = newSessionClaims({ ...member, role: "VOLUNTEER" }, ["MARSHAL"], false, 0);
    const a = newSessionClaims(admin, [], false, 0);
    expect(areaDecision("/", null, 1)).toEqual({ action: "allow" });
    expect(areaDecision("/member", null, 1)).toEqual({ action: "login", reason: "signed-out" });
    expect(areaDecision("/member/check-in", m, 1)).toEqual({ action: "allow" });
    expect(areaDecision("/volunteer", m, 1)).toEqual({ action: "forbidden" });
    expect(areaDecision("/admin", m, 1)).toEqual({ action: "forbidden" });
    expect(areaDecision("/volunteer/marshal", v, 1)).toEqual({ action: "allow" });
    expect(areaDecision("/member", a, 1)).toEqual({ action: "allow" });
    expect(areaDecision("/admin/settings", a, ADMIN_IDLE_MS + 5)).toEqual({ action: "login", reason: "idle" });
    expect(areaOf("/administrator")).toBeNull();
  });

  it("sends people home by role and only follows same-site next links", () => {
    expect([homeFor("MEMBER"), homeFor("VOLUNTEER"), homeFor("ADMIN")]).toEqual(["/member", "/volunteer", "/admin"]);
    expect(safeNext("/member/attendance?x=1")).toBe("/member/attendance?x=1");
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("lockout and rate limits", () => {
  it("locks after 5 failures within 15 minutes, for 15 minutes from the fifth", () => {
    const f = [0, 1000, 2000, 3000];
    expect(lockoutState(f, 4000).locked).toBe(false);
    const five = [...f, 4000];
    const s = lockoutState(five, 5000);
    expect(s.locked).toBe(true);
    expect(s.retryAfterMs).toBe(LOCKOUT_MS - 5000 + 0);
    expect(lockoutState(five, LOCKOUT_MS + 1).locked).toBe(false);
  });
  it("ignores old failures", () => {
    expect(lockoutState([0, 1, 2, 3, LOCKOUT_MS + 10], LOCKOUT_MS + 20).locked).toBe(false);
  });
  it("limits hits in a sliding window", () => {
    let hits: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = slidingWindow(hits, i, 3, 100);
      expect(r.allowed).toBe(true);
      hits = r.hits;
    }
    const blocked = slidingWindow(hits, 50, 3, 100);
    expect(blocked).toMatchObject({ allowed: false, retryAfterMs: 50 });
    expect(slidingWindow(hits, 101, 3, 100).allowed).toBe(true);
  });
});

describe("password strength", () => {
  it.each([
    ["short", 0, "Too short"],
    ["alllowercase", 1, "Weak"],
    ["lowercase123", 2, "Fair"],
    ["Lowercase123", 3, "Good"],
    ["alllowercaseletters", 2, "Fair"],
    ["Serve-With-Excellence-2026", 4, "Strong"],
  ])("%s scores %s (%s)", (pw, score, label) => {
    expect(passwordStrength(pw)).toMatchObject({ score, label });
  });
  it("penalises common words and accepts Fair or better", () => {
    expect(passwordStrength("Password12345!").score).toBeLessThan(passwordStrength("Tunde-Mop-Ikeja1").score);
    expect(isAcceptablePassword("lowercase123")).toBe(true);
    expect(isAcceptablePassword("alllowercase")).toBe(false);
  });
});

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 test secret "12345678901234567890" (SHA-1).
  const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));

  it("encodes base32 both ways", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("matches the RFC vector at T=%s", (t, code) => {
    expect(hotp(base32Decode(secret), Math.floor(t / 30), 8)).toBe(code);
  });
  it("verifies the current code with one step of drift either way", () => {
    const now = 1_700_000_000_000;
    const code = totp(secret, now);
    expect(verifyTotp(secret, code, now)).toBe(true);
    expect(verifyTotp(secret, code, now + 30_000)).toBe(true);
    expect(verifyTotp(secret, code, now + 90_000)).toBe(false);
    expect(verifyTotp(secret, "12ab56", now)).toBe(false);
  });
  it("builds an otpauth URI for the QR code", () => {
    expect(otpauthUri("ABC", "a@example.com")).toBe(
      "otpauth://totp/HOD%20Sanitation%20Hub%3Aa%40example.com?secret=ABC&issuer=HOD%20Sanitation%20Hub&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("sign-up validation", () => {
  const ok = {
    role: "MEMBER",
    name: "Amaka Nwosu",
    email: "Amaka@Example.com ",
    phone: "+234 803 000 1111",
    password: "Serve-With-Excellence-2026",
    country: "Nigeria",
    city: "Lagos",
    language: "en",
    consentLocation: true,
    consentReminders: true,
  };
  it("accepts a complete form and normalises the email", () => {
    const r = signupBody.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("amaka@example.com");
  });
  it("requires both consents, a full name, a 10-character password and a valid phone", () => {
    const issues = (v: object) => {
      const r = signupBody.safeParse({ ...ok, ...v });
      return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join(".")))];
    };
    expect(issues({ consentLocation: false })).toEqual(["consentLocation"]);
    expect(issues({ consentReminders: false })).toEqual(["consentReminders"]);
    expect(issues({ name: "Amaka" })).toEqual(["name"]);
    expect(issues({ password: "Short1!" })).toEqual(["password"]);
    expect(issues({ phone: "call me" })).toEqual(["phone"]);
  });
});
