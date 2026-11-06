import "server-only";
import type { SentEmail } from "@/lib/notifications/senders";

/**
 * In-memory security state for the mock phases: failed sign-ins (lockout), rate-limit hits,
 * known devices and the demo email outbox. Phase 8 moves these to the database or Redis.
 */
interface AuthStore {
  failures: Map<string, number[]>;
  rate: Map<string, number[]>;
  devices: Map<string, Set<string>>;
  outbox: SentEmail[];
}

const g = globalThis as unknown as { __hodAuthStore?: AuthStore };

export function authStore(): AuthStore {
  if (!g.__hodAuthStore) g.__hodAuthStore = { failures: new Map(), rate: new Map(), devices: new Map(), outbox: [] };
  return g.__hodAuthStore;
}

export function resetAuthStore(): void {
  g.__hodAuthStore = { failures: new Map(), rate: new Map(), devices: new Map(), outbox: [] };
}
