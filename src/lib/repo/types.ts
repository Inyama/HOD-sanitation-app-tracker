/**
 * Domain types mirroring the Prisma schema in spec section 9.
 * Dates are ISO 8601 strings in UTC so records serialise cleanly over HTTP and JSON.
 * Composite-key models (TeamMember, UserBadge) get a synthetic `id` here; see docs/DECISIONS.md.
 */

export type Role = "MEMBER" | "VOLUNTEER" | "ADMIN";
export type AdminLevel = "SUPER" | "UNIT" | "ATTENDANCE_OFFICER" | "COMMS_OFFICER" | "AUDITOR";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type TitleCode = "TEAM_LEAD" | "ZONE_CAPTAIN" | "MARSHAL" | "SUPPLIES_KEEPER" | "WELCOME" | "PRAYER_COORDINATOR";
export type MeetingType = "SATURDAY" | "THURSDAY_PRAYER" | "SPECIAL";
export type TrackingMethod = "GEO" | "SHEET" | "BOTH";
export type MeetingStatus = "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED";
export type AttendanceStatus = "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED";
export type RecordMethod = "GEO" | "SHEET" | "MANUAL";
export type ExcuseStatus = "PENDING" | "APPROVED" | "DECLINED";
export type Channel = "IN_APP" | "EMAIL" | "PUSH" | "SMS" | "WHATSAPP";
export type NotifStatus = "SCHEDULED" | "SENT" | "FAILED" | "READ";
export type Urgency = "LOW" | "MEDIUM" | "URGENT";
export type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type DutyStatus = "ASSIGNED" | "SWAP_REQUESTED" | "SWAPPED" | "DONE";
export type UploadStatus = "PREVIEW" | "CONFIRMED" | "ROLLED_BACK";
export type MatchType = "EMAIL" | "NAME_SUGGESTED" | "NOT_FOUND" | "DUPLICATE";
export type RsvpAnswer = "GOING" | "MAYBE" | "NO";

export const TITLE_LABELS: Record<TitleCode, string> = {
  TEAM_LEAD: "Team Lead",
  ZONE_CAPTAIN: "Zone Captain",
  MARSHAL: "Check-in Marshal",
  SUPPLIES_KEEPER: "Supplies Keeper",
  WELCOME: "Welcome Team",
  PRAYER_COORDINATOR: "Prayer Coordinator",
};

export const ADMIN_LEVEL_LABELS: Record<AdminLevel, string> = {
  SUPER: "Super Admin",
  UNIT: "Unit Admin",
  ATTENDANCE_OFFICER: "Attendance Officer",
  COMMS_OFFICER: "Communications Officer",
  AUDITOR: "Auditor",
};

export interface NotifPrefs {
  email: boolean;
  inApp: boolean;
  push: boolean;
  /** Optional messages; meeting reminders and account emails cannot be turned off. */
  weeklySummary: boolean;
  nudges: boolean;
  quietHours: { start: string; end: string } | null;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  email: true,
  inApp: true,
  push: false,
  weeklySummary: true,
  nudges: true,
  quietHours: { start: "22:00", end: "06:00" },
};

export interface User {
  id: string;
  name: string;
  email: string;
  secondaryEmail: string | null;
  phone: string | null;
  passwordHash: string;
  role: Role;
  adminLevel: AdminLevel | null;
  status: UserStatus;
  isRemote: boolean;
  country: string | null;
  city: string | null;
  timezone: string;
  language: string;
  avatarUrl: string | null;
  totpSecret: string | null;
  approvedAt: string | null;
  lastLoginAt: string | null;
  notifPrefs: NotifPrefs;
  createdAt: string;
  /** Added: when status became SUSPENDED or REMOVED, and why (soft delete is kept 30 days). */
  statusChangedAt: string | null;
  statusReason: string | null;
  /** Added: consent records (spec 12). */
  consentLocationAt: string | null;
  consentRemindersAt: string | null;
  /** Added: email verification (spec 4.3). */
  emailVerifiedAt: string | null;
  /** Added: extra details captured at sign-up. */
  signupDetails: SignupDetails | null;
  /** Added: when the person asked for their account to be deleted (spec 12). */
  deletionRequestedAt: string | null;
}

export interface SignupDetails {
  unitCode: string | null;
  /** Volunteers: zones they would like to serve in. */
  zones?: string[];
  /** Volunteers: when they are usually available. */
  availability?: string[];
  notes?: string | null;
}

/** Added: private notes admins keep about a person (spec 7.4 member profile). Never shown to the person. */
export interface MemberNote {
  id: string;
  userId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface UserTitle {
  id: string;
  userId: string;
  title: TitleCode;
  assignedById: string | null;
  assignedAt: string;
}

export interface Zone {
  id: string;
  name: string;
  description: string | null;
}

export interface Team {
  id: string;
  name: string;
  zoneId: string | null;
  leadUserId: string | null;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Added: false until an admin confirms the pin on site. */
  verified: boolean;
}

export interface Meeting {
  id: string;
  type: MeetingType;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venueId: string | null;
  method: TrackingMethod;
  graceMinutes: number;
  openBeforeMin: number;
  closeAfterMin: number;
  status: MeetingStatus;
  recurrenceRule: string | null;
  requireQr: boolean;
  /** Added: note shown when cancelled or rescheduled. */
  statusNote: string | null;
}

export interface AttendanceRecord {
  id: string;
  meetingId: string;
  userId: string;
  status: AttendanceStatus;
  checkedInAt: string | null;
  method: RecordMethod;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  deviceId: string | null;
  flagged: boolean;
  flagReason: string | null;
  sourceUploadId: string | null;
  recordedById: string | null;
  note: string | null;
}

export interface AttendanceUpload {
  id: string;
  meetingId: string;
  fileUrl: string;
  originalName: string;
  uploadedById: string;
  status: UploadStatus;
  rowsTotal: number;
  rowsMatched: number;
  rowsException: number;
  uploadedAt: string;
  rolledBackAt: string | null;
}

export interface UploadRow {
  id: string;
  uploadId: string;
  rawName: string;
  rawEmail: string | null;
  rawTime: string | null;
  matchedUserId: string | null;
  matchType: MatchType;
  similarity: number | null;
  resolution: string | null;
}

export interface ExcuseRequest {
  id: string;
  userId: string;
  meetingId: string;
  reason: string;
  proofUrl: string | null;
  status: ExcuseStatus;
  reviewedById: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  channel: Channel;
  title: string;
  body: string;
  scheduledFor: string;
  sentAt: string | null;
  readAt: string | null;
  status: NotifStatus;
  dedupeKey: string;
}

export interface Message {
  id: string;
  senderId: string;
  subject: string;
  body: string;
  audience: AudienceSpec;
  channels: Channel[];
  scheduledFor: string | null;
  sentAt: string | null;
  /** Added: files attached to the message. */
  attachments?: { name: string; url: string; size: string }[];
}

export type AudienceSpec =
  | { kind: "EVERYONE" }
  | { kind: "ALL_MEMBERS" }
  | { kind: "ALL_VOLUNTEERS" }
  | { kind: "TEAM"; teamId: string }
  | { kind: "BAND"; band: "gold" | "green" | "amber" | "red" }
  | { kind: "ABSENT_LAST_SATURDAY" }
  | { kind: "HAND_PICKED"; userIds: string[] };

export interface MessageRecipient {
  id: string;
  messageId: string;
  userId: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  authorId: string;
  createdAt: string;
}

export interface EventRsvp {
  id: string;
  meetingId: string;
  userId: string;
  answer: RsvpAnswer;
}

export interface DutyAssignment {
  id: string;
  meetingId: string;
  zoneId: string;
  userId: string;
  status: DutyStatus;
}

export interface ServiceHour {
  id: string;
  userId: string;
  meetingId: string | null;
  hours: number;
  source: "AUTO" | "MANUAL";
  verifiedById: string | null;
  createdAt: string;
  /** Added: what the manual entry was for. */
  note: string | null;
}

export interface IssueReport {
  id: string;
  reporterId: string;
  area: string;
  urgency: Urgency;
  photoUrl: string | null;
  note: string;
  status: IssueStatus;
  resolvedById: string | null;
  createdAt: string;
}

export type BadgeCode = "PERFECT_MONTH" | "ON_TIME_10" | "FAITHFUL_SERVANT" | "COMEBACK" | "SERVICE_STAR";

export interface Badge {
  id: string;
  code: BadgeCode;
  name: string;
  rule: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
}

export interface Invite {
  id: string;
  email: string;
  adminLevel: AdminLevel;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

/** Typed view of the Setting key-value table. */
export interface AppSettings {
  venueId: string;
  timezone: string;
  graceMinutes: number;
  openBeforeMinutes: number;
  closeAfterMinutes: number;
  maxAccuracyM: number;
  lateWeight: number;
  bandThresholds: { gold: number; green: number; amber: number };
  atRiskPercent: number;
  atRiskConsecutiveAbsences: number;
  lowAttendancePercent: number;
  quietHours: { start: string; end: string };
  locationRetentionMonths: number;
  demoMode: boolean;
  branding: { primary: string; accent: string; logoUrl: string };
}
