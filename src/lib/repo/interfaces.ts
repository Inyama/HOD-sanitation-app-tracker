import type {
  Announcement,
  AppSettings,
  AttendanceRecord,
  AttendanceUpload,
  AuditLog,
  Badge,
  DutyAssignment,
  EventRsvp,
  ExcuseRequest,
  Invite,
  IssueReport,
  Meeting,
  Message,
  MessageRecipient,
  Notification,
  ServiceHour,
  Team,
  TeamMember,
  UploadRow,
  User,
  UserBadge,
  UserTitle,
  Venue,
  Zone,
} from "./types";

/**
 * Repository interface. Screens and route handlers talk only to this. Until Phase 8 it is
 * implemented by the in-memory json-mock repository; Phase 8 adds a Prisma implementation
 * with the same shape. Filters are equality-only so they translate directly to Prisma `where`.
 */

export interface ListOptions<T> {
  where?: Partial<T>;
  /** Match any of these values for a field, e.g. { status: ["ACTIVE", "PENDING"] }. */
  whereIn?: { [K in keyof T]?: T[K][] };
  orderBy?: { field: keyof T; dir?: "asc" | "desc" };
  limit?: number;
  offset?: number;
}

export interface Table<T extends { id: string }> {
  list(opts?: ListOptions<T>): Promise<T[]>;
  count(opts?: Pick<ListOptions<T>, "where" | "whereIn">): Promise<number>;
  get(id: string): Promise<T | null>;
  findFirst(where: Partial<T>): Promise<T | null>;
  create(data: Omit<T, "id"> & { id?: string }): Promise<T>;
  createMany(data: (Omit<T, "id"> & { id?: string })[]): Promise<T[]>;
  update(id: string, patch: Partial<Omit<T, "id">>): Promise<T>;
  delete(id: string): Promise<void>;
  deleteMany(where: Partial<T>): Promise<number>;
}

/** The audit log is append-only (spec 12): no update or delete. */
export interface AppendOnly<T extends { id: string }> {
  list(opts?: ListOptions<T>): Promise<T[]>;
  count(opts?: Pick<ListOptions<T>, "where" | "whereIn">): Promise<number>;
  append(data: Omit<T, "id" | "createdAt"> & { createdAt?: string }): Promise<T>;
}

export interface SettingsStore {
  get(): Promise<AppSettings>;
  update(patch: Partial<AppSettings>): Promise<AppSettings>;
}

export interface Repository {
  users: Table<User>;
  userTitles: Table<UserTitle>;
  zones: Table<Zone>;
  teams: Table<Team>;
  teamMembers: Table<TeamMember>;
  venues: Table<Venue>;
  meetings: Table<Meeting>;
  records: Table<AttendanceRecord>;
  uploads: Table<AttendanceUpload>;
  uploadRows: Table<UploadRow>;
  excuses: Table<ExcuseRequest>;
  notifications: Table<Notification>;
  messages: Table<Message>;
  messageRecipients: Table<MessageRecipient>;
  announcements: Table<Announcement>;
  rsvps: Table<EventRsvp>;
  duties: Table<DutyAssignment>;
  serviceHours: Table<ServiceHour>;
  issues: Table<IssueReport>;
  badges: Table<Badge>;
  userBadges: Table<UserBadge>;
  invites: Table<Invite>;
  audit: AppendOnly<AuditLog>;
  settings: SettingsStore;
  /** Run several writes as one unit; on error the json-mock restores the previous state. */
  transaction<R>(fn: (repo: Repository) => Promise<R>): Promise<R>;
  /** Demo only: restore the deterministic seed. */
  reset(): Promise<void>;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}
