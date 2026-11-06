import { isDemoMode } from "@/lib/env";

const DEV_FALLBACK = "hod-demo-only-secret-not-for-production-use-2026";

/**
 * Signing secret for sessions and links. A built-in fallback is allowed only in demo mode
 * or development; production without AUTH_SECRET refuses to start signing.
 */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (isDemoMode() || process.env.NODE_ENV !== "production") return DEV_FALLBACK;
  throw new Error("AUTH_SECRET must be set (32+ characters) when demo mode is off.");
}
