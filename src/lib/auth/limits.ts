/** Lockout and rate limiting (spec 4.3, 12). Pure functions over lists of timestamps. */

export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export interface LockoutState {
  locked: boolean;
  retryAfterMs: number;
  /** Failures still relevant (inside the lockout window). */
  failures: number[];
}

/** Five failed sign-ins within 15 minutes lock the account for 15 minutes from the fifth failure. */
export function lockoutState(failures: number[], nowMs: number): LockoutState {
  const recent = failures.filter((t) => nowMs - t < LOCKOUT_MS).sort((a, b) => a - b);
  if (recent.length >= MAX_FAILURES) {
    const until = recent[recent.length - MAX_FAILURES] + LOCKOUT_MS;
    if (until > nowMs) return { locked: true, retryAfterMs: until - nowMs, failures: recent };
  }
  return { locked: false, retryAfterMs: 0, failures: recent };
}

export interface RateResult {
  allowed: boolean;
  retryAfterMs: number;
  hits: number[];
}

/** Sliding-window limiter: at most `limit` hits per `windowMs`. Records the hit when allowed. */
export function slidingWindow(hits: number[], nowMs: number, limit: number, windowMs: number): RateResult {
  const kept = hits.filter((t) => nowMs - t < windowMs);
  if (kept.length >= limit) {
    return { allowed: false, retryAfterMs: kept[0] + windowMs - nowMs, hits: kept };
  }
  return { allowed: true, retryAfterMs: 0, hits: [...kept, nowMs] };
}

export const RATE_LIMITS = {
  login: { limit: 30, windowMs: 60_000 },
  signup: { limit: 10, windowMs: 10 * 60_000 },
  forgot: { limit: 10, windowMs: 10 * 60_000 },
  twoFactor: { limit: 10, windowMs: 10 * 60_000 },
} as const;

export function minutesText(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return `${m} minute${m === 1 ? "" : "s"}`;
}
