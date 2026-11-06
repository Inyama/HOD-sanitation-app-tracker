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
  /** Check-in attempts per person (anti-spoofing: more than 5 in 10 minutes is flagged). */
  checkInAttempts: Map<string, number[]>;
  /** Uploaded files (excuse proofs, avatars) until Phase 8 adds real storage. */
  files: Map<string, StoredFile>;
}

export interface StoredFile {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  data: Buffer;
  createdAt: string;
}

const g = globalThis as unknown as { __hodAuthStore?: AuthStore };

function fresh(): AuthStore {
  return {
    failures: new Map(),
    rate: new Map(),
    devices: new Map(),
    outbox: [],
    checkInAttempts: new Map(),
    files: new Map(),
  };
}

export function authStore(): AuthStore {
  // Fill in fields added after a dev server first created the store (hot reload keeps globalThis).
  g.__hodAuthStore = { ...fresh(), ...g.__hodAuthStore };
  return g.__hodAuthStore;
}

export function resetAuthStore(): void {
  g.__hodAuthStore = fresh();
}
