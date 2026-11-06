import "server-only";
import { getRepository } from "./json-mock";
import type { Repository } from "./interfaces";

/**
 * The repository the server uses. Phase 8 switches this to the Prisma implementation
 * (selected by DATABASE_URL) without changing any caller.
 */
export function repo(): Repository {
  return getRepository();
}

export type { Repository } from "./interfaces";
