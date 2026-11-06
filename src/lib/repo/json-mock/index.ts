import { buildSeed, type SeedData } from "@/data/seed";
import { now } from "@/lib/time/clock";
import type { AppSettings, AuditLog } from "../types";
import { NotFoundError, type AppendOnly, type ListOptions, type Repository, type Table } from "../interfaces";

/**
 * In-memory repository seeded from the deterministic generators (Phases 0 to 7).
 * State lives for the life of the server process (kept on globalThis so dev reloads keep it)
 * and resets on restart or via reset(). Values are cloned in and out so callers never share
 * references with the store.
 */

type Row = { id: string };
type TableKey = Exclude<keyof SeedData, "settings" | "demo" | "sampleSheets" | "auditLogs">;

interface State {
  tables: { [K in TableKey]: Map<string, SeedData[K][number]> };
  audit: AuditLog[];
  settings: AppSettings;
  seq: number;
}

const clone = <T>(v: T): T => structuredClone(v);

function fromSeed(seed: SeedData): State {
  const keys: TableKey[] = [
    "users",
    "userTitles",
    "zones",
    "teams",
    "teamMembers",
    "venues",
    "meetings",
    "records",
    "uploads",
    "uploadRows",
    "excuses",
    "notifications",
    "messages",
    "messageRecipients",
    "announcements",
    "rsvps",
    "duties",
    "serviceHours",
    "issues",
    "badges",
    "userBadges",
    "invites",
  ];
  const tables = {} as State["tables"];
  for (const k of keys) {
    (tables as Record<string, Map<string, Row>>)[k] = new Map((seed[k] as Row[]).map((r) => [r.id, clone(r)]));
  }
  return { tables, audit: clone(seed.auditLogs), settings: clone(seed.settings), seq: 0 };
}

function matches<T>(row: T, opts?: Pick<ListOptions<T>, "where" | "whereIn">): boolean {
  if (!opts) return true;
  if (opts.where) {
    for (const [k, v] of Object.entries(opts.where) as [keyof T, unknown][]) {
      if (v !== undefined && row[k] !== v) return false;
    }
  }
  if (opts.whereIn) {
    for (const [k, vs] of Object.entries(opts.whereIn) as [keyof T, unknown[] | undefined][]) {
      if (vs && !vs.includes(row[k])) return false;
    }
  }
  return true;
}

function applyList<T>(rows: T[], opts?: ListOptions<T>): T[] {
  let out = rows.filter((r) => matches(r, opts));
  if (opts?.orderBy) {
    const { field, dir = "asc" } = opts.orderBy;
    const f = dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const va = a[field] as unknown as string | number | null;
      const vb = b[field] as unknown as string | number | null;
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return va > vb ? f : -f;
    });
  }
  const start = opts?.offset ?? 0;
  return out.slice(start, opts?.limit !== undefined ? start + opts.limit : undefined);
}

export function createJsonMockRepository(initial?: SeedData): Repository {
  let state = fromSeed(initial ?? buildSeed());

  const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(state.seq++).toString(36)}`;

  function table<K extends TableKey>(key: K, prefix: string): Table<SeedData[K][number]> {
    type T = SeedData[K][number];
    const map = () => state.tables[key] as unknown as Map<string, T>;
    return {
      async list(opts) {
        return applyList([...map().values()], opts).map(clone);
      },
      async count(opts) {
        return [...map().values()].filter((r) => matches(r, opts)).length;
      },
      async get(id) {
        const r = map().get(id);
        return r ? clone(r) : null;
      },
      async findFirst(where) {
        const r = [...map().values()].find((x) => matches(x, { where }));
        return r ? clone(r) : null;
      },
      async create(data) {
        const id = data.id ?? nextId(prefix);
        if (map().has(id)) throw new Error(`${key} ${id} already exists`);
        const row = clone({ ...data, id }) as T;
        map().set(id, row);
        return clone(row);
      },
      async createMany(data) {
        const out: T[] = [];
        for (const d of data) out.push(await this.create(d));
        return out;
      },
      async update(id, patch) {
        const existing = map().get(id);
        if (!existing) throw new NotFoundError(key, id);
        const row = { ...existing, ...clone(patch), id } as T;
        map().set(id, row);
        return clone(row);
      },
      async delete(id) {
        if (!map().delete(id)) throw new NotFoundError(key, id);
      },
      async deleteMany(where) {
        let n = 0;
        for (const [id, r] of map()) {
          if (matches(r, { where })) {
            map().delete(id);
            n++;
          }
        }
        return n;
      },
    };
  }

  const audit: AppendOnly<AuditLog> = {
    async list(opts) {
      return applyList(state.audit, opts).map(clone);
    },
    async count(opts) {
      return state.audit.filter((r) => matches(r, opts)).length;
    },
    async append(data) {
      const row: AuditLog = { ...clone(data), id: nextId("aud"), createdAt: data.createdAt ?? now().toISO()! };
      state.audit.push(row);
      return clone(row);
    },
  };

  const repo: Repository = {
    users: table("users", "usr"),
    userTitles: table("userTitles", "ttl"),
    zones: table("zones", "zone"),
    teams: table("teams", "team"),
    teamMembers: table("teamMembers", "tm"),
    venues: table("venues", "venue"),
    meetings: table("meetings", "mtg"),
    records: table("records", "rec"),
    uploads: table("uploads", "upl"),
    uploadRows: table("uploadRows", "row"),
    excuses: table("excuses", "exc"),
    notifications: table("notifications", "ntf"),
    messages: table("messages", "msg"),
    messageRecipients: table("messageRecipients", "mr"),
    announcements: table("announcements", "ann"),
    rsvps: table("rsvps", "rsvp"),
    duties: table("duties", "duty"),
    serviceHours: table("serviceHours", "hrs"),
    issues: table("issues", "iss"),
    badges: table("badges", "badge"),
    userBadges: table("userBadges", "ub"),
    invites: table("invites", "inv"),
    audit,
    settings: {
      async get() {
        return clone(state.settings);
      },
      async update(patch) {
        state.settings = { ...state.settings, ...clone(patch) };
        return clone(state.settings);
      },
    },
    async transaction(fn) {
      const snapshot = structuredClone(state);
      try {
        return await fn(repo);
      } catch (e) {
        state = snapshot;
        throw e;
      }
    },
    async reset() {
      state = fromSeed(buildSeed());
    },
  };
  return repo;
}

// ---------------------------------------------------------------------------
// Process-wide instance (survives Next.js dev hot reloads).
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __hodRepo?: Repository };

export function getRepository(): Repository {
  if (!g.__hodRepo) g.__hodRepo = createJsonMockRepository();
  return g.__hodRepo;
}
