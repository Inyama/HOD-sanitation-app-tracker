import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isDemoMode } from "@/lib/env";

/**
 * Password hashing for the mock phases: scrypt from node:crypto (N=16384, r=8, p=1).
 * Phase 8 switches to Argon2 behind the same two functions; verify keeps accepting scrypt
 * hashes so existing accounts can be rehashed on next sign-in.
 */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const DEMO_PREFIX = "demo-plain:";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(DEMO_PREFIX)) {
    // Seeded demo accounts only; never accepted outside demo mode.
    if (!isDemoMode()) return false;
    const expected = Buffer.from(stored.slice(DEMO_PREFIX.length));
    const given = Buffer.from(password);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const key = await scrypt(password, salt, expected.length);
  return timingSafeEqual(key, expected);
}

/** A stable value derived from the stored hash, so reset links stop working once the password changes. */
export function passwordFingerprint(stored: string): string {
  return stored.slice(-12);
}
