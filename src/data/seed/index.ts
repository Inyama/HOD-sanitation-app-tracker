import { DateTime } from "luxon";
import type {
  Announcement,
  AppSettings,
  AttendanceRecord,
  AttendanceStatus,
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
} from "@/lib/repo/types";
import { DEFAULT_NOTIF_PREFS } from "@/lib/repo/types";
import { lagosTime, MEETING_ZONE } from "@/lib/time/zone";
import { meetingId, previousOccurrences, rruleFor, SATURDAY_RULE, THURSDAY_RULE } from "@/lib/time/schedule";
import { distanceMetres, describeFlags, offsetCoordinate } from "@/lib/attendance/geofence";
import { attendanceViews, countedMeetings } from "@/lib/attendance/aggregate";
import { BADGE_DEFS, computeBadges } from "@/lib/attendance/badges";
import { matchSheet, type SheetRow } from "@/lib/matching/matchSheet";
import { renderNotification, type RenderContext } from "@/lib/notifications/templates";
import type { NotificationType } from "@/lib/notifications/schedule";
import { resolveAudience, type AudiencePerson } from "@/lib/notifications/audience";
import { Rng } from "./random";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  FIRST_NAMES,
  GENERATED_PLAN,
  OTHER_CITIES,
  PROFILE_RULES,
  SURNAMES,
  type PersonDef,
  type Profile,
} from "./people";
import { PLANTED, plantedStatuses } from "./planted";

/** The instant the seed describes: Friday 6 November 2026, 10:00 Lagos (spec section 0). */
export const SEED_NOW = lagosTime(2026, 11, 6, 10, 0);
export const VENUE_ID = "venue-main";
/** Thursday 5 Nov: the sheet is uploaded but still in Preview, so no records yet. */
export const PREVIEW_MEETING_ID = "mtg-2026-11-05-thu";
export const CANCELLED_SATURDAY = "2026-08-15";
/** Mock-only password marker; Phase 8 stores Argon2 hashes. */
export const DEMO_PASSWORD_HASH = `demo-plain:${DEMO_PASSWORD}`;

export interface SeedData {
  users: User[];
  userTitles: UserTitle[];
  zones: Zone[];
  teams: Team[];
  teamMembers: TeamMember[];
  venues: Venue[];
  meetings: Meeting[];
  records: AttendanceRecord[];
  uploads: AttendanceUpload[];
  uploadRows: UploadRow[];
  excuses: ExcuseRequest[];
  notifications: Notification[];
  messages: Message[];
  messageRecipients: MessageRecipient[];
  announcements: Announcement[];
  rsvps: EventRsvp[];
  duties: DutyAssignment[];
  serviceHours: ServiceHour[];
  issues: IssueReport[];
  badges: Badge[];
  userBadges: UserBadge[];
  invites: Invite[];
  auditLogs: AuditLog[];
  settings: AppSettings;
  /** Demo account key to user id, e.g. demo.adebayo = "usr-adebayo". */
  demo: Record<string, string>;
  /** Sheets for Thursday 5 November (written to src/data/sample-sheets). */
  sampleSheets: { clean: SheetRow[]; withErrors: SheetRow[] };
}

export const DEFAULT_SETTINGS: AppSettings = {
  venueId: VENUE_ID,
  timezone: MEETING_ZONE,
  graceMinutes: 0,
  openBeforeMinutes: 60,
  closeAfterMinutes: 120,
  maxAccuracyM: 50,
  lateWeight: 1,
  bandThresholds: { gold: 90, green: 75, amber: 50 },
  atRiskPercent: 60,
  atRiskConsecutiveAbsences: 3,
  lowAttendancePercent: 60,
  quietHours: { start: "22:00", end: "06:00" },
  locationRetentionMonths: 12,
  demoMode: true,
  branding: { primary: "#1e40af", accent: "#d4a437", logoUrl: "/images/HOD-logo.webp" },
};

const iso = (d: DateTime) => d.toUTC().toISO()!;
const lagosDate = (isoStr: string) => DateTime.fromISO(isoStr, { zone: "utc" }).setZone(MEETING_ZONE).toISODate()!;

/** Generated people have keys g01, g02, ...; demo accounts have names (note "grace" also starts with g). */
const isGenerated = (key: string) => /^g\d+$/.test(key);

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

// ---------------------------------------------------------------------------

export function buildSeed(): SeedData {
  const rng = new Rng();
  const now = SEED_NOW;

  // ---- Venue, zones, settings ------------------------------------------------
  const venue: Venue = {
    id: VENUE_ID,
    name: "Household of David, Ikeja",
    address: "7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos, Nigeria",
    lat: 6.6018,
    lng: 3.3515,
    radiusM: 100,
    verified: false,
  };
  const zones: Zone[] = [
    { id: "zone-sanctuary", name: "Sanctuary", description: "Main auditorium, stage and aisles" },
    { id: "zone-restrooms", name: "Restrooms", description: "All restrooms and washrooms" },
    { id: "zone-entrance", name: "Entrance", description: "Gate, lobby and car park walkway" },
    { id: "zone-kitchen", name: "Kitchen", description: "Kitchen, pantry and fellowship hall" },
    { id: "zone-outdoors", name: "Outdoors", description: "Grounds, gutters and perimeter" },
  ];

  // ---- Meetings ------------------------------------------------------------
  const dayStart = now.setZone(MEETING_ZONE).startOf("day").toUTC();
  const meetings: Meeting[] = [];
  const addMeeting = (m: Omit<Meeting, "venueId" | "requireQr" | "statusNote" | "endsAt"> & Partial<Meeting>) =>
    meetings.push({ venueId: VENUE_ID, requireQr: false, statusNote: null, endsAt: null, ...m });

  for (const start of previousOccurrences(SATURDAY_RULE, dayStart, 26)) {
    const cancelled = lagosDate(iso(start)) === CANCELLED_SATURDAY;
    addMeeting({
      id: meetingId("SATURDAY", start),
      type: "SATURDAY",
      title: SATURDAY_RULE.title,
      startsAt: iso(start),
      endsAt: iso(start.plus({ hours: 2 })),
      method: "GEO",
      graceMinutes: 0,
      openBeforeMin: 60,
      closeAfterMin: 120,
      status: cancelled ? "CANCELLED" : "CLOSED",
      statusNote: cancelled ? "Cancelled: venue maintenance" : null,
      recurrenceRule: rruleFor(SATURDAY_RULE),
    });
  }
  for (const start of previousOccurrences(THURSDAY_RULE, dayStart, 26)) {
    addMeeting({
      id: meetingId("THURSDAY_PRAYER", start),
      type: "THURSDAY_PRAYER",
      title: THURSDAY_RULE.title,
      startsAt: iso(start),
      endsAt: iso(start.plus({ minutes: 90 })),
      method: "SHEET",
      graceMinutes: 0,
      openBeforeMin: 0,
      closeAfterMin: 0,
      status: "CLOSED",
      recurrenceRule: rruleFor(THURSDAY_RULE),
    });
  }
  const upcoming: [DateTime, "SATURDAY" | "THURSDAY_PRAYER"][] = [
    [lagosTime(2026, 11, 7, 9, 30), "SATURDAY"],
    [lagosTime(2026, 11, 12, 20, 30), "THURSDAY_PRAYER"],
    [lagosTime(2026, 11, 14, 9, 30), "SATURDAY"],
  ];
  for (const [start, type] of upcoming) {
    const rule = type === "SATURDAY" ? SATURDAY_RULE : THURSDAY_RULE;
    addMeeting({
      id: meetingId(type, start),
      type,
      title: rule.title,
      startsAt: iso(start),
      endsAt: iso(start.plus({ minutes: type === "SATURDAY" ? 120 : 90 })),
      method: rule.method,
      graceMinutes: 0,
      openBeforeMin: rule.openBeforeMin,
      closeAfterMin: rule.closeAfterMin,
      status: "SCHEDULED",
      recurrenceRule: rruleFor(rule),
    });
  }
  const training = lagosTime(2026, 11, 17, 10, 0);
  addMeeting({
    id: "mtg-2026-11-17-evt",
    type: "SPECIAL",
    title: "Training Morning",
    startsAt: iso(training),
    endsAt: iso(training.plus({ hours: 2 })),
    method: "SHEET",
    graceMinutes: 10,
    openBeforeMin: 0,
    closeAfterMin: 0,
    status: "SCHEDULED",
    recurrenceRule: null,
  });
  const deepClean = lagosTime(2026, 11, 28, 7, 30);
  addMeeting({
    id: "mtg-2026-11-28-evt",
    type: "SPECIAL",
    title: "Deep Clean Day",
    startsAt: iso(deepClean),
    endsAt: iso(deepClean.plus({ hours: 5 })),
    method: "GEO",
    graceMinutes: 15,
    openBeforeMin: 60,
    closeAfterMin: 180,
    status: "SCHEDULED",
    recurrenceRule: null,
  });
  meetings.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const pastHeld = meetings.filter(
    (m) => m.status !== "CANCELLED" && DateTime.fromISO(m.startsAt) <= now && m.id !== PREVIEW_MEETING_ID,
  );

  // ---- People ------------------------------------------------------------------
  const prng = rng.fork(1);
  const defs: (PersonDef & { id: string })[] = DEMO_ACCOUNTS.map((d) => ({ ...d, id: `usr-${d.key}` }));
  const takenNames = new Set(defs.map((d) => d.name));
  const profiles: Profile[] = ["reliable", "regular", "casual", "struggling"];
  const profileWeights = [0.25, 0.35, 0.25, 0.15];
  const pickProfile = () => {
    const u = prng.float();
    let acc = 0;
    for (let i = 0; i < profiles.length; i++) {
      acc += profileWeights[i];
      if (u < acc) return profiles[i];
    }
    return "regular" as Profile;
  };
  let g = 0;
  for (const plan of GENERATED_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      let name = "";
      do {
        name = `${prng.pick(FIRST_NAMES)} ${prng.pick(SURNAMES)}`;
      } while (takenNames.has(name));
      takenNames.add(name);
      g++;
      const where = prng.chance(0.9) ? prng.pick(OTHER_CITIES.slice(0, 5)) : prng.pick(OTHER_CITIES);
      defs.push({
        key: `g${String(g).padStart(2, "0")}`,
        id: `usr-g${String(g).padStart(2, "0")}`,
        name,
        email: `${slug(name)}${g}@example.com`,
        role: plan.role,
        status: plan.cohort === "pending" ? "PENDING" : "ACTIVE",
        cohort: plan.cohort,
        profile: pickProfile(),
        city: where.city,
        country: where.country,
        timezone: where.timezone,
      });
    }
  }

  // Titles for generated volunteers: the five "year" volunteers lead teams; "half" volunteers get other titles.
  const genVolunteers = defs.filter((d) => isGenerated(d.key) && d.role === "VOLUNTEER");
  const leadDefs = genVolunteers.filter((d) => d.cohort === "year");
  leadDefs.forEach((d) => (d.titles = ["TEAM_LEAD"]));
  const otherTitles: PersonDef["titles"][] = [["MARSHAL"], ["ZONE_CAPTAIN"], ["WELCOME"], ["PRAYER_COORDINATOR"]];
  genVolunteers.filter((d) => d.cohort === "half").forEach((d, i) => (d.titles = otherTitles[i % otherTitles.length]));

  // Approval dates.
  const approvedAtFor = (d: PersonDef & { id: string }): DateTime | null => {
    if (d.cohort === "pending") return null;
    if (d.key === "tobi") return lagosTime(2026, 10, 16, 12, 0);
    const pattern = d.planted ? PLANTED[d.planted] : undefined;
    if (pattern?.countedMeetings) {
      const first = pastHeld[pastHeld.length - pattern.countedMeetings];
      return DateTime.fromISO(first.startsAt, { zone: "utc" }).minus({ days: 1 });
    }
    if (d.cohort === "year") return lagosTime(2025, 11, 6, 12, 0).minus({ days: prng.int(0, 20) });
    if (d.cohort === "half") return lagosTime(2026, 5, 6, 12, 0).minus({ days: prng.int(0, 3) });
    return now
      .minus({ days: prng.int(7, 54) })
      .setZone(MEETING_ZONE)
      .set({ hour: 11, minute: 0 })
      .toUTC();
  };

  const users: User[] = defs.map((d) => {
    const approved = approvedAtFor(d);
    const created = approved ? approved.minus({ days: prng.int(1, 5) }) : now.minus({ days: prng.int(1, 12) });
    const where = d.city
      ? { city: d.city, country: d.country ?? "Nigeria", timezone: d.timezone ?? MEETING_ZONE }
      : { city: "Lagos", country: "Nigeria", timezone: MEETING_ZONE };
    return {
      id: d.id,
      name: d.name,
      email: d.email,
      secondaryEmail: null,
      phone: d.isRemote
        ? `+44 7700 ${prng.int(900000, 900999)}`
        : `+234 80${prng.int(1, 9)} ${prng.int(100, 999)} ${prng.int(1000, 9999)}`,
      passwordHash: DEMO_PASSWORD_HASH,
      role: d.role,
      adminLevel: d.adminLevel ?? null,
      status: d.status,
      isRemote: !!d.isRemote,
      country: where.country,
      city: where.city,
      timezone: where.timezone,
      language: "en",
      avatarUrl: null,
      totpSecret: d.role === "ADMIN" ? "DEMO-TOTP-ANY-SIX-DIGITS" : null,
      approvedAt: approved ? iso(approved) : null,
      lastLoginAt: d.status === "ACTIVE" ? iso(now.minus({ hours: prng.int(2, 240) })) : null,
      notifPrefs: { ...DEFAULT_NOTIF_PREFS, push: prng.chance(0.4) },
      createdAt: iso(created),
      statusChangedAt: d.status === "SUSPENDED" ? iso(lagosTime(2026, 9, 20, 14, 0)) : null,
      statusReason:
        d.status === "SUSPENDED"
          ? "Repeated no-shows without contact; suspended pending a conversation with the Unit Lead."
          : null,
      consentLocationAt: iso(created),
      consentRemindersAt: iso(created),
      // One pending volunteer has not confirmed their email yet.
      emailVerifiedAt: d.cohort === "pending" && d.role === "VOLUNTEER" ? null : iso(created.plus({ minutes: 20 })),
      signupDetails:
        d.cohort === "pending" ? { unitCode: null, notes: "Heard about the unit at the newcomers' lunch." } : null,
    };
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const defById = new Map(defs.map((d) => [d.id, d]));
  const demo: Record<string, string> = Object.fromEntries(DEMO_ACCOUNTS.map((d) => [d.key, `usr-${d.key}`]));
  // Give one person a secondary email so sheet matching on it can be demonstrated.
  users.find((u) => u.id === "usr-g03")!.secondaryEmail = "personal.g03@example.com";

  const userTitles: UserTitle[] = defs.flatMap((d) =>
    (d.titles ?? []).map((t) => ({
      id: `ttl-${d.key}-${t.toLowerCase()}`,
      userId: d.id,
      title: t,
      assignedById: demo.daniel,
      assignedAt: users.find((u) => u.id === d.id)!.approvedAt ?? iso(now),
    })),
  );

  // ---- Teams ---------------------------------------------------------------
  const teamDefs = [
    { id: "team-sanctuary-a", name: "Sanctuary A", zoneId: "zone-sanctuary" },
    { id: "team-sanctuary-b", name: "Sanctuary B", zoneId: "zone-sanctuary" },
    { id: "team-restrooms", name: "Restrooms", zoneId: "zone-restrooms" },
    { id: "team-entrance", name: "Entrance", zoneId: "zone-entrance" },
    { id: "team-kitchen", name: "Kitchen", zoneId: "zone-kitchen" },
    { id: "team-outdoors", name: "Outdoors", zoneId: "zone-outdoors" },
  ];
  const leads = [demo.grace, ...leadDefs.map((d) => d.id)];
  const teams: Team[] = teamDefs.map((t, i) => ({ ...t, leadUserId: leads[i] }));
  const teamMembers: TeamMember[] = [];
  const trng = rng.fork(2);
  const pool = trng.shuffle(
    users.filter((u) => u.role !== "ADMIN" && u.approvedAt && !leads.includes(u.id)).map((u) => u.id),
  );
  teams.forEach((t) => teamMembers.push({ id: `${t.id}:${t.leadUserId}`, teamId: t.id, userId: t.leadUserId! }));
  pool.forEach((uid, i) => {
    const t = teams[i % teams.length];
    teamMembers.push({ id: `${t.id}:${uid}`, teamId: t.id, userId: uid });
  });
  const teamOf = (uid: string) => teamMembers.filter((tm) => tm.userId === uid).map((tm) => tm.teamId);

  // ---- Attendance records ----------------------------------------------------------
  const arng = rng.fork(3);
  const records: AttendanceRecord[] = [];
  const suspendedFrom = lagosTime(2026, 9, 20, 14, 0);
  const uploadFor: Record<string, string> = {
    "mtg-2026-10-22-thu": "upl-2026-10-22",
    "mtg-2026-10-29-thu": "upl-2026-10-29",
  };

  for (const u of users) {
    if (!u.approvedAt) continue;
    const def = defById.get(u.id)!;
    const approved = DateTime.fromISO(u.approvedAt, { zone: "utc" });
    const list = pastHeld.filter((m) => {
      const s = DateTime.fromISO(m.startsAt, { zone: "utc" });
      if (s < approved) return false;
      if (u.isRemote && m.type === "SATURDAY") return false;
      if (u.status === "SUSPENDED" && s > suspendedFrom) return false;
      return true;
    });
    const pattern = def.planted ? PLANTED[def.planted] : undefined;
    const statuses: AttendanceStatus[] = pattern
      ? plantedStatuses(
          pattern,
          list.map((m) => lagosDate(m.startsAt)),
        )
      : list.map(() => {
          const rules = PROFILE_RULES[def.profile];
          if (arng.chance(rules.attend)) return arng.chance(rules.late) ? "LATE" : "ON_TIME";
          return arng.chance(0.26) ? "EXCUSED" : "ABSENT";
        });

    list.forEach((m, i) => {
      const status = statuses[i];
      const start = DateTime.fromISO(m.startsAt, { zone: "utc" });
      const present = status === "ON_TIME" || status === "LATE";
      const base: AttendanceRecord = {
        id: `rec-${m.id.slice(4)}-${u.id.slice(4)}`,
        meetingId: m.id,
        userId: u.id,
        status,
        checkedInAt: null,
        method: m.type === "SATURDAY" ? "GEO" : "SHEET",
        lat: null,
        lng: null,
        accuracyM: null,
        distanceM: null,
        deviceId: null,
        flagged: false,
        flagReason: null,
        sourceUploadId: uploadFor[m.id] ?? null,
        recordedById: null,
        note: status === "EXCUSED" ? "Approved excuse" : null,
      };
      if (present) {
        if (m.type === "SATURDAY") {
          const at =
            status === "ON_TIME"
              ? start.minus({ minutes: arng.int(1, 55) })
              : start.plus({ minutes: arng.int(1, 100) });
          const dist = arng.range(5, 90);
          const bearing = arng.range(0, Math.PI * 2);
          const p = offsetCoordinate(venue.lat, venue.lng, dist * Math.cos(bearing), dist * Math.sin(bearing));
          base.checkedInAt = iso(at.plus({ seconds: arng.int(0, 59) }));
          base.lat = Math.round(p.lat * 1e7) / 1e7;
          base.lng = Math.round(p.lng * 1e7) / 1e7;
          base.accuracyM = Math.round(arng.range(5, 35) * 10) / 10;
          base.distanceM = Math.round(distanceMetres(base.lat, base.lng, venue.lat, venue.lng) * 10) / 10;
          base.deviceId = `dev-${u.id.slice(4)}`;
        } else {
          const at =
            status === "ON_TIME" ? start.minus({ minutes: arng.int(0, 25) }) : start.plus({ minutes: arng.int(1, 40) });
          base.checkedInAt = iso(at);
        }
      }
      records.push(base);
    });
  }

  // Manual check-ins by the marshal (already reviewed), and one recent one awaiting review.
  const genSaturdayPresent = records.filter(
    (r) =>
      r.method === "GEO" &&
      (r.status === "ON_TIME" || r.status === "LATE") &&
      !defById.get(r.userId)!.planted &&
      isGenerated(defById.get(r.userId)!.key),
  );
  const manualPick = arng.shuffle(genSaturdayPresent.filter((r) => r.meetingId !== "mtg-2026-10-31-sat")).slice(0, 6);
  for (const r of manualPick) {
    Object.assign(r, {
      method: "MANUAL",
      lat: null,
      lng: null,
      accuracyM: null,
      distanceM: null,
      deviceId: null,
      recordedById: demo.grace,
      note: "Checked in by marshal: phone battery flat",
    });
  }
  const oct31 = arng.shuffle(
    genSaturdayPresent.filter((r) => r.meetingId === "mtg-2026-10-31-sat" && r.method === "GEO"),
  );
  const manualFlagged = oct31[0];
  Object.assign(manualFlagged, {
    method: "MANUAL",
    lat: null,
    lng: null,
    accuracyM: null,
    distanceM: null,
    deviceId: null,
    recordedById: demo.grace,
    flagged: true,
    flagReason: "Manual check-in: awaiting admin review",
    note: "No smartphone with them today",
  });
  // Flagged geolocation check-in: 48 m accuracy on a device another account already used.
  const [firstOnDevice, sharer] = [oct31[1], oct31[2]];
  Object.assign(sharer, {
    deviceId: firstOnDevice.deviceId,
    accuracyM: 48,
    flagged: true,
    flagReason: `${describeFlags(["SHARED_DEVICE"])}; GPS accuracy 48 m, close to the 50 m limit`,
  });

  const recordsByUser = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    if (!recordsByUser.has(r.userId)) recordsByUser.set(r.userId, []);
    recordsByUser.get(r.userId)!.push(r);
  }
  const viewsFor = (u: User) =>
    attendanceViews(recordsByUser.get(u.id) ?? [], meetings, { approvedAt: u.approvedAt, now });

  // ---- Thursday 5 November sheets and uploads ---------------------------------------
  const srng = rng.fork(4);
  const nov5 = meetingById.get(PREVIEW_MEETING_ID)!;
  const nov5Start = DateTime.fromISO(nov5.startsAt, { zone: "utc" });
  const attendees = users.filter((u) => {
    if (u.status !== "ACTIVE" || !u.approvedAt || DateTime.fromISO(u.approvedAt) > nov5Start) return false;
    if (u.id === demo.adebayo) return true;
    if (u.id === demo.chioma) return false;
    return srng.chance(PROFILE_RULES[defById.get(u.id)!.profile].attend);
  });
  const timeFor = () => {
    const late = srng.chance(0.15);
    const t = late ? nov5Start.plus({ minutes: srng.int(2, 35) }) : nov5Start.minus({ minutes: srng.int(0, 25) });
    return t.setZone(MEETING_ZONE).toFormat("HH:mm");
  };
  const cleanRows: SheetRow[] = attendees.map((u) => ({
    name: u.name,
    email: u.email,
    phone: u.phone,
    time: timeFor(),
  }));
  const withErrors: SheetRow[] = cleanRows.map((r) =>
    r.email === userById.get(demo.adebayo)!.email ? { ...r, name: "Adebayo Jonhson", email: null } : { ...r },
  );
  withErrors.splice(Math.min(9, withErrors.length), 0, {
    name: "Kelechi Nnamdi",
    email: "kelechi.nnamdi@example.com",
    phone: "+234 803 555 0142",
    time: "20:26",
  });
  const dupSource = withErrors[4];
  withErrors.splice(Math.min(17, withErrors.length), 0, { ...dupSource });

  const matchPeople = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    secondaryEmail: u.secondaryEmail,
    status: u.status,
  }));
  const preview = matchSheet(withErrors, matchPeople);

  const uploads: AttendanceUpload[] = [];
  const uploadRows: UploadRow[] = [];
  for (const [mid, uid] of Object.entries(uploadFor)) {
    const present = records.filter((r) => r.meetingId === mid && (r.status === "ON_TIME" || r.status === "LATE"));
    const start = DateTime.fromISO(meetingById.get(mid)!.startsAt);
    const isSecond = mid === "mtg-2026-10-29-thu";
    uploads.push({
      id: uid,
      meetingId: mid,
      fileUrl: `/uploads/${uid}.${isSecond ? "xlsx" : "csv"}`,
      originalName: `thursday-prayer-${lagosDate(iso(start))}.${isSecond ? "xlsx" : "csv"}`,
      uploadedById: demo.esther,
      status: "CONFIRMED",
      rowsTotal: present.length,
      rowsMatched: present.length - (isSecond ? 1 : 0),
      rowsException: isSecond ? 1 : 0,
      uploadedAt: iso(start.plus({ hours: 14 })),
      rolledBackAt: null,
    });
    present.forEach((r, i) => {
      const u = userById.get(r.userId)!;
      const suggested = isSecond && i === 2;
      uploadRows.push({
        id: `${uid}-row-${String(i + 1).padStart(3, "0")}`,
        uploadId: uid,
        rawName: suggested ? u.name.split(" ").reverse().join(" ") : u.name,
        rawEmail: suggested ? null : u.email,
        rawTime: r.checkedInAt ? DateTime.fromISO(r.checkedInAt).setZone(MEETING_ZONE).toFormat("HH:mm") : null,
        matchedUserId: u.id,
        matchType: suggested ? "NAME_SUGGESTED" : "EMAIL",
        similarity: 1,
        resolution: suggested ? "CONFIRMED" : null,
      });
    });
  }
  uploads.push({
    id: "upl-2026-11-05",
    meetingId: PREVIEW_MEETING_ID,
    fileUrl: "/uploads/upl-2026-11-05.csv",
    originalName: "thursday-with-errors.csv",
    uploadedById: demo.esther,
    status: "PREVIEW",
    rowsTotal: preview.summary.total,
    rowsMatched: preview.summary.matched,
    rowsException: preview.summary.exceptions,
    uploadedAt: iso(lagosTime(2026, 11, 6, 8, 40)),
    rolledBackAt: null,
  });
  preview.rows.forEach((m) =>
    uploadRows.push({
      id: `upl-2026-11-05-row-${String(m.index + 1).padStart(3, "0")}`,
      uploadId: "upl-2026-11-05",
      rawName: m.row.name,
      rawEmail: m.row.email,
      rawTime: m.row.time ?? null,
      matchedUserId: m.matchedUserId,
      matchType: m.matchType,
      similarity: m.similarity,
      resolution: null,
    }),
  );

  // ---- Excuse requests (8) --------------------------------------------------------
  const erng = rng.fork(5);
  const excuses: ExcuseRequest[] = [];
  const recent = (r: AttendanceRecord, days: number) =>
    DateTime.fromISO(meetingById.get(r.meetingId)!.startsAt) > now.minus({ days });
  const reasons = [
    "Travelled to Ibadan for a family burial.",
    "Down with malaria; I have a hospital note.",
    "Work shift was moved to Saturday morning at short notice.",
    "My child was unwell and I had to stay home.",
    "Stuck in traffic after a road closure on Ikorodu Road.",
    "Writing a professional exam that morning.",
  ];
  const excusedRecent = erng
    .shuffle(records.filter((r) => r.status === "EXCUSED" && recent(r, 50) && !defById.get(r.userId)!.planted))
    .slice(0, 4);
  excusedRecent.forEach((r, i) =>
    excuses.push({
      id: `exc-${String(i + 1).padStart(2, "0")}`,
      userId: r.userId,
      meetingId: r.meetingId,
      reason: reasons[i],
      proofUrl: i % 2 === 0 ? `/uploads/proof-${i + 1}.pdf` : null,
      status: "APPROVED",
      reviewedById: i % 2 ? demo.funke : demo.esther,
      reviewNote: "Thank you for letting us know. Get well soon.",
      createdAt: iso(DateTime.fromISO(meetingById.get(r.meetingId)!.startsAt).minus({ days: 1 })),
    }),
  );
  const absentRecent = erng.shuffle(
    records.filter(
      (r) =>
        r.status === "ABSENT" &&
        recent(r, 40) &&
        !defById.get(r.userId)!.planted &&
        r.meetingId !== "mtg-2026-10-31-sat",
    ),
  );
  absentRecent.slice(0, 2).forEach((r, i) =>
    excuses.push({
      id: `exc-${String(excuses.length + 1).padStart(2, "0")}`,
      userId: r.userId,
      meetingId: r.meetingId,
      reason: reasons[4 + i],
      proofUrl: null,
      status: "DECLINED",
      reviewedById: demo.esther,
      reviewNote: "Submitted after the 7-day window and without detail. Please speak with your Team Lead.",
      createdAt: iso(DateTime.fromISO(meetingById.get(r.meetingId)!.startsAt).plus({ days: 2 })),
    }),
  );
  const chiomaOct31 = records.find((r) => r.userId === demo.chioma && r.meetingId === "mtg-2026-10-31-sat")!;
  excuses.push({
    id: "exc-07",
    userId: demo.chioma,
    meetingId: chiomaOct31.meetingId,
    reason: "My mother was admitted to hospital on Friday night and I stayed with her.",
    proofUrl: "/uploads/proof-chioma.jpg",
    status: "PENDING",
    reviewedById: null,
    reviewNote: null,
    createdAt: iso(lagosTime(2026, 11, 2, 18, 12)),
  });
  const otherOct31 = records.find(
    (r) =>
      r.meetingId === "mtg-2026-10-31-sat" &&
      r.status === "ABSENT" &&
      !defById.get(r.userId)!.planted &&
      userById.get(r.userId)!.status === "ACTIVE",
  )!;
  excuses.push({
    id: "exc-08",
    userId: otherOct31.userId,
    meetingId: otherOct31.meetingId,
    reason: "Flight back from Abuja was delayed overnight.",
    proofUrl: null,
    status: "PENDING",
    reviewedById: null,
    reviewNote: null,
    createdAt: iso(lagosTime(2026, 11, 1, 9, 30)),
  });

  // ---- Service hours ---------------------------------------------------------------
  const hrng = rng.fork(6);
  const serviceHours: ServiceHour[] = [];
  const hoursFrom = lagosTime(2026, 8, 1, 0, 0);
  for (const u of users.filter((x) => x.role === "VOLUNTEER" && x.approvedAt)) {
    for (const r of recordsByUser.get(u.id) ?? []) {
      const m = meetingById.get(r.meetingId)!;
      if (m.type !== "SATURDAY" || (r.status !== "ON_TIME" && r.status !== "LATE")) continue;
      const start = DateTime.fromISO(m.startsAt, { zone: "utc" });
      if (start < hoursFrom) continue;
      serviceHours.push({
        id: `hrs-${r.id.slice(4)}`,
        userId: u.id,
        meetingId: m.id,
        hours: 2,
        source: "AUTO",
        verifiedById: null,
        createdAt: iso(start.plus({ hours: 3 })),
        note: null,
      });
    }
  }
  serviceHours.push(
    {
      id: "hrs-grace-m1",
      userId: demo.grace,
      meetingId: null,
      hours: 3,
      source: "MANUAL",
      verifiedById: demo.funke,
      createdAt: iso(lagosTime(2026, 10, 10, 16, 0)),
      note: "Kitchen deep clean after the harvest thanksgiving",
    },
    {
      id: "hrs-grace-m2",
      userId: demo.grace,
      meetingId: null,
      hours: 2,
      source: "MANUAL",
      verifiedById: demo.funke,
      createdAt: iso(lagosTime(2026, 9, 20, 15, 0)),
      note: "Restocked supplies with the Supplies Keeper",
    },
    {
      id: "hrs-michael-m1",
      userId: demo.michael,
      meetingId: null,
      hours: 2.5,
      source: "MANUAL",
      verifiedById: null,
      createdAt: iso(lagosTime(2026, 11, 3, 17, 0)),
      note: "Bought and sorted new mops and buckets",
    },
  );
  for (const v of genVolunteers.filter((d) => d.cohort !== "pending").slice(0, 3)) {
    serviceHours.push({
      id: `hrs-${v.key}-m1`,
      userId: v.id,
      meetingId: null,
      hours: hrng.pick([1.5, 2, 3]),
      source: "MANUAL",
      verifiedById: hrng.chance(0.5) ? demo.funke : null,
      createdAt: iso(now.minus({ days: hrng.int(3, 20) })),
      note: "Midweek clean-up before a church event",
    });
  }
  // AUTO hours are system-generated and count as verified.
  const isVerified = (h: ServiceHour) => h.source === "AUTO" || !!h.verifiedById;

  // ---- Badges ---------------------------------------------------------------------
  const badges: Badge[] = (Object.keys(BADGE_DEFS) as (keyof typeof BADGE_DEFS)[]).map((code) => ({
    id: `badge-${code.toLowerCase()}`,
    code,
    name: BADGE_DEFS[code].name,
    rule: BADGE_DEFS[code].rule,
  }));
  const userBadges: UserBadge[] = [];
  for (const u of users.filter((x) => x.approvedAt)) {
    const counted = countedMeetings(recordsByUser.get(u.id) ?? [], meetings, { approvedAt: u.approvedAt, now });
    const hours = serviceHours
      .filter((h) => h.userId === u.id)
      .map((h) => ({ hours: h.hours, createdAt: h.createdAt, verified: isVerified(h) }));
    for (const b of computeBadges({ counted, hours, now })) {
      userBadges.push({
        id: `${u.id}:${b.code}`,
        userId: u.id,
        badgeId: `badge-${b.code.toLowerCase()}`,
        earnedAt: b.earnedAt,
      });
    }
  }

  // ---- Announcements (4, one pinned) -----------------------------------------------
  const announcements: Announcement[] = [
    {
      id: "ann-1",
      title: "Deep Clean Day on Saturday 28 November",
      body: "Our end-of-year deep clean starts at 7:30 am. Please wear comfortable clothes and bring gloves. Breakfast is provided.",
      pinned: true,
      authorId: demo.daniel,
      createdAt: iso(lagosTime(2026, 11, 2, 9, 0)),
    },
    {
      id: "ann-2",
      title: "New check-in on your phone",
      body: "From this month, Saturday attendance is recorded by checking in on the app when you arrive at the venue. Marshals can help if your phone is flat.",
      pinned: false,
      authorId: demo.joshua,
      createdAt: iso(lagosTime(2026, 10, 12, 10, 0)),
    },
    {
      id: "ann-3",
      title: "Training Morning for new volunteers",
      body: "Tuesday 17 November, 10:00 am. We will cover safe use of cleaning chemicals and the duty board.",
      pinned: false,
      authorId: demo.funke,
      createdAt: iso(lagosTime(2026, 10, 30, 12, 0)),
    },
    {
      id: "ann-4",
      title: "Thank you for a wonderful harvest service",
      body: "The sanctuary was spotless. Thank you to every team that served last weekend.",
      pinned: false,
      authorId: demo.daniel,
      createdAt: iso(lagosTime(2026, 10, 5, 13, 0)),
    },
  ];

  // ---- Messages (12) ----------------------------------------------------------------
  const audiencePeople: AudiencePerson[] = users.map((u) => {
    const v = viewsFor(u);
    const oct31Rec = (recordsByUser.get(u.id) ?? []).find((r) => r.meetingId === "mtg-2026-10-31-sat");
    return {
      id: u.id,
      role: u.role,
      status: u.status,
      teamIds: teamOf(u.id),
      band: v.overall.band.key,
      absentLastSaturday: oct31Rec?.status === "ABSENT",
    };
  });
  const recentApproved = users
    .filter((u) => u.approvedAt && DateTime.fromISO(u.approvedAt) > now.minus({ weeks: 8 }))
    .map((u) => u.id);
  const msgDefs: Omit<Message, "id">[] = [
    {
      senderId: demo.daniel,
      subject: "Welcome to the Sanitation Unit",
      body: "Hello {first_name}, welcome to the Sanitation Unit of Household of David. We meet every Saturday at 9:30 am and pray together every Thursday at 8:30 pm.",
      audience: { kind: "HAND_PICKED", userIds: recentApproved },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 18, 9, 0)),
    },
    {
      senderId: demo.joshua,
      subject: "Please bring gloves this Saturday",
      body: "Hello {first_name}, we are cleaning the gutters this Saturday. Please bring gloves if you have them.",
      audience: { kind: "EVERYONE" },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 30, 17, 0)),
    },
    {
      senderId: demo.daniel,
      subject: "Congratulations on your faithfulness",
      body: "Hello {first_name}, your attendance is {percentage} percent. Thank you for serving with excellence.",
      audience: { kind: "BAND", band: "gold" },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 4, 12, 0)),
    },
    {
      senderId: demo.joshua,
      subject: "We missed you on Saturday",
      body: "Hello {first_name}, we missed you last Saturday. If anything is wrong, please let us know.",
      audience: { kind: "ABSENT_LAST_SATURDAY" },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 11, 1, 9, 0)),
    },
    {
      senderId: demo.joshua,
      subject: "New: check in on your phone",
      body: "Saturday attendance is now recorded by checking in on the app at the venue.",
      audience: { kind: "EVERYONE" },
      channels: ["IN_APP"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 12, 10, 5)),
    },
    {
      senderId: demo.daniel,
      subject: "Deep Clean Day: save the date",
      body: "Our end-of-year deep clean is on Saturday 28 November from 7:30 am.",
      audience: { kind: "EVERYONE" },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 11, 2, 9, 5)),
    },
    {
      senderId: demo.grace,
      subject: "Sanctuary A: new chairs arrangement",
      body: "Team, please note the new chair layout for Sunday service when you reset the sanctuary.",
      audience: { kind: "TEAM", teamId: "team-sanctuary-a" },
      channels: ["IN_APP"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 25, 19, 0)),
    },
    {
      senderId: demo.funke,
      subject: "Duty roster for November is out",
      body: "Volunteers, the duty board for November is published. Sign up for your zone.",
      audience: { kind: "ALL_VOLUNTEERS" },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 28, 8, 0)),
    },
    {
      senderId: demo.joshua,
      subject: "Joining Thursday prayer online",
      body: "If you cannot come in person, join the Thursday prayer online. You will still be recorded from the attendee sheet.",
      audience: { kind: "ALL_MEMBERS" },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 20, 18, 0)),
    },
    {
      senderId: demo.daniel,
      subject: "We are cheering you on",
      body: "Hello {first_name}, your attendance is {percentage} percent. A few more Saturdays and you will be back in the green.",
      audience: { kind: "BAND", band: "amber" },
      channels: ["IN_APP"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 10, 26, 12, 0)),
    },
    {
      senderId: demo.daniel,
      subject: "Welcome to our September joiners",
      body: "Hello {first_name}, it is a joy to have you in the unit.",
      audience: { kind: "ALL_MEMBERS" },
      channels: ["IN_APP"],
      scheduledFor: null,
      sentAt: iso(lagosTime(2026, 9, 14, 9, 0)),
    },
    {
      senderId: demo.joshua,
      subject: "Reminder: Saturday 14 November",
      body: "Hello {first_name}, see you on Saturday at 9:30 am.",
      audience: { kind: "EVERYONE" },
      channels: ["IN_APP", "EMAIL"],
      scheduledFor: iso(lagosTime(2026, 11, 13, 9, 30)),
      sentAt: null,
    },
  ];
  const messages: Message[] = msgDefs.map((m, i) => ({ ...m, id: `msg-${String(i + 1).padStart(2, "0")}` }));
  const mrng = rng.fork(7);
  const messageRecipients: MessageRecipient[] = messages.flatMap((m) =>
    m.sentAt
      ? resolveAudience(m.audience, audiencePeople).map((uid) => ({
          id: `${m.id}:${uid}`,
          messageId: m.id,
          userId: uid,
          deliveredAt: m.sentAt,
          readAt: mrng.chance(0.65) ? iso(DateTime.fromISO(m.sentAt!).plus({ hours: mrng.int(1, 48) })) : null,
        }))
      : [],
  );

  // ---- Notifications (5 to 15 per active person) ------------------------------------
  const nrng = rng.fork(8);
  const notifications: Notification[] = [];
  const windowStart = lagosTime(2026, 10, 16, 0, 0);
  const remindersPast = meetings.filter((m) => {
    const s = DateTime.fromISO(m.startsAt);
    return s >= windowStart && s <= now && m.status !== "CANCELLED";
  });
  const venueAddress = venue.address;
  for (const u of users.filter((x) => x.status === "ACTIVE" && x.approvedAt)) {
    const v = viewsFor(u).overall;
    const ctxBase: RenderContext = {
      fullName: u.name,
      timezone: u.timezone,
      venueAddress,
      percentage: v.percent,
      band: v.band.label,
      checkinLink: "/member/check-in",
      nextMeeting: "Saturday Sanitation Meeting, Sat 7 Nov 9:30 am",
    };
    const items: {
      type: NotificationType;
      at: DateTime;
      meetingId: string;
      ctx: RenderContext;
      channel: "IN_APP" | "EMAIL";
    }[] = [];
    for (const m of remindersPast) {
      const s = DateTime.fromISO(m.startsAt, { zone: "utc" });
      if (DateTime.fromISO(u.approvedAt!) > s) continue;
      const ctx = { ...ctxBase, meetingName: m.title, startsAt: m.startsAt };
      if (m.type === "SATURDAY" && !u.isRemote) {
        items.push({ type: "SAT_DAY_BEFORE", at: s.minus({ days: 1 }), meetingId: m.id, ctx, channel: "IN_APP" });
        const rec = (recordsByUser.get(u.id) ?? []).find((r) => r.meetingId === m.id);
        if (rec?.status === "ABSENT")
          items.push({
            type: "ABSENCE_FOLLOWUP",
            at: s.setZone(MEETING_ZONE).plus({ days: 1 }).set({ hour: 9, minute: 0 }).toUTC(),
            meetingId: m.id,
            ctx,
            channel: "IN_APP",
          });
        if (rec?.status === "LATE" || rec?.status === "ABSENT")
          items.push({ type: "SAT_LATE_NOTICE", at: s, meetingId: m.id, ctx, channel: "IN_APP" });
      }
      if (m.type === "THURSDAY_PRAYER")
        items.push({ type: "THU_HOUR_BEFORE", at: s.minus({ hours: 1 }), meetingId: m.id, ctx, channel: "IN_APP" });
    }
    for (const sunday of [
      lagosTime(2026, 10, 18, 18, 0),
      lagosTime(2026, 10, 25, 18, 0),
      lagosTime(2026, 11, 1, 18, 0),
    ]) {
      items.push({
        type: "WEEKLY_SUMMARY",
        at: sunday,
        meetingId: `week-${sunday.setZone(MEETING_ZONE).toFormat("kkkk-'W'WW")}`,
        ctx: ctxBase,
        channel: "EMAIL",
      });
    }
    if (v.percent !== null && v.percent < DEFAULT_SETTINGS.lowAttendancePercent) {
      items.push({
        type: "LOW_ATTENDANCE",
        at: lagosTime(2026, 11, 1, 10, 0),
        meetingId: "mtg-2026-10-31-sat",
        ctx: ctxBase,
        channel: "IN_APP",
      });
    }
    const chosen = items.sort((a, b) => a.at.toMillis() - b.at.toMillis()).slice(-15);
    const unread = nrng.int(1, 4);
    chosen.forEach((it, i) => {
      const t = renderNotification(it.type, it.ctx);
      const isUnread = i >= chosen.length - unread && it.channel === "IN_APP";
      notifications.push({
        id: `ntf-${u.id.slice(4)}-${String(i + 1).padStart(2, "0")}`,
        userId: u.id,
        type: it.type,
        channel: it.channel,
        title: t.title,
        body: t.body,
        scheduledFor: iso(it.at),
        sentAt: iso(it.at),
        readAt: isUnread || it.channel === "EMAIL" ? null : iso(it.at.plus({ minutes: nrng.int(5, 600) })),
        status: isUnread || it.channel === "EMAIL" ? "SENT" : "READ",
        dedupeKey: `${u.id}:${it.meetingId}:${it.type}:${it.channel}`,
      });
    });
  }

  // ---- RSVPs ----------------------------------------------------------------------
  const rrng = rng.fork(9);
  const rsvps: EventRsvp[] = [];
  const volunteersActive = users.filter((u) => u.role === "VOLUNTEER" && u.status === "ACTIVE");
  for (const mid of ["mtg-2026-11-07-sat", "mtg-2026-11-17-evt", "mtg-2026-11-28-evt"]) {
    for (const u of volunteersActive) {
      if (rrng.chance(0.25)) continue;
      rsvps.push({
        id: `rsvp-${mid.slice(4)}-${u.id.slice(4)}`,
        meetingId: mid,
        userId: u.id,
        answer: rrng.pick(["GOING", "GOING", "GOING", "MAYBE", "NO"] as const),
      });
    }
  }

  // ---- Duty assignments (20) ------------------------------------------------------------
  const drng = rng.fork(10);
  const duties: DutyAssignment[] = [];
  const dutyPool = drng.shuffle([
    ...volunteersActive.map((u) => u.id),
    ...users
      .filter((u) => u.role === "MEMBER" && u.status === "ACTIVE")
      .slice(0, 10)
      .map((u) => u.id),
  ]);
  const addDuties = (mid: string, count: number, offset: number) => {
    for (let i = 0; i < count; i++) {
      duties.push({
        id: `duty-${mid.slice(4, 14)}-${String(i + 1).padStart(2, "0")}`,
        meetingId: mid,
        zoneId: zones[i % zones.length].id,
        userId: dutyPool[(offset + i) % dutyPool.length],
        status: "ASSIGNED",
      });
    }
  };
  addDuties("mtg-2026-11-07-sat", 12, 0);
  addDuties("mtg-2026-11-14-sat", 8, 12);
  const swap = duties.find((d) => d.userId === demo.michael) ?? duties[3];
  swap.status = "SWAP_REQUESTED";
  if (!duties.some((d) => d.userId === demo.grace && d.meetingId === "mtg-2026-11-07-sat")) {
    duties[0].userId = demo.grace;
  }

  // ---- Issue reports (10) --------------------------------------------------------------
  const issues: IssueReport[] = [
    {
      area: "Restrooms",
      urgency: "URGENT",
      status: "OPEN",
      note: "Leaking pipe under the second sink in the men's restroom; water on the floor.",
      days: 1,
    },
    {
      area: "Kitchen",
      urgency: "URGENT",
      status: "OPEN",
      note: "Gas smell near the back burner. Burner switched off and area taped.",
      days: 2,
    },
    {
      area: "Entrance",
      urgency: "URGENT",
      status: "OPEN",
      note: "Broken glass panel on the main door; sharp edges exposed.",
      days: 0,
    },
    { area: "Sanctuary", urgency: "MEDIUM", status: "OPEN", note: "Two ceiling fans wobble at full speed.", days: 4 },
    { area: "Outdoors", urgency: "LOW", status: "OPEN", note: "Weeds growing through the car park paving.", days: 6 },
    {
      area: "Restrooms",
      urgency: "MEDIUM",
      status: "IN_PROGRESS",
      note: "Hand dryer in the women's restroom not working.",
      days: 9,
    },
    {
      area: "Kitchen",
      urgency: "LOW",
      status: "IN_PROGRESS",
      note: "Need two new mop heads and a bucket wringer.",
      days: 11,
    },
    {
      area: "Sanctuary",
      urgency: "MEDIUM",
      status: "IN_PROGRESS",
      note: "Carpet stain by the choir stand after Sunday service.",
      days: 13,
    },
    { area: "Entrance", urgency: "LOW", status: "RESOLVED", note: "Doormat worn through; replaced.", days: 20 },
    {
      area: "Outdoors",
      urgency: "URGENT",
      status: "RESOLVED",
      note: "Blocked gutter flooding the side path; cleared.",
      days: 25,
    },
  ].map((x, i) => ({
    id: `iss-${String(i + 1).padStart(2, "0")}`,
    reporterId: volunteersActive[i % volunteersActive.length].id,
    area: x.area,
    urgency: x.urgency as IssueReport["urgency"],
    photoUrl: i % 3 === 0 ? `/uploads/issue-${i + 1}.jpg` : null,
    note: x.note,
    status: x.status as IssueReport["status"],
    resolvedById: x.status === "RESOLVED" ? demo.funke : null,
    createdAt: iso(now.minus({ days: x.days, hours: i })),
  }));

  // ---- Invites ------------------------------------------------------------------------
  // Invite links: /accept-invite/demo-invite-2026 (valid) and /accept-invite/demo-invite-expired.
  // Only SHA-256 hashes of the tokens are stored.
  const invites: Invite[] = [
    {
      id: "inv-1",
      email: "new.comms@example.com",
      adminLevel: "COMMS_OFFICER",
      tokenHash: "294c351780c6e3e9172d24d95178ce9f66882c8a3dc6daea0962cb112a823c0a",
      expiresAt: "2099-12-31T23:00:00.000Z",
      usedAt: null,
    },
    {
      id: "inv-2",
      email: "late.admin@example.com",
      adminLevel: "AUDITOR",
      tokenHash: "04e49e5902d66a8a27228a6b11ee7f3177853922176bcad184c329bf4df64c58",
      expiresAt: iso(lagosTime(2026, 10, 30, 12, 0)),
      usedAt: null,
    },
  ];

  // ---- Audit log (25) -------------------------------------------------------------------
  const auditLogs: AuditLog[] = [];
  const audit = (
    daysAgo: number,
    actor: string,
    action: string,
    entity: string,
    entityId: string | null,
    before: unknown = null,
    after: unknown = null,
  ) =>
    auditLogs.push({
      id: `aud-${String(auditLogs.length + 1).padStart(3, "0")}`,
      actorId: actor,
      action,
      entity,
      entityId,
      before,
      after,
      ip: "102.89.34.17",
      createdAt: iso(now.minus({ days: daysAgo, minutes: auditLogs.length * 7 })),
    });
  audit(60, demo.daniel, "SETTINGS_UPDATED", "Setting", "geofence", { radiusM: 150 }, { radiusM: 100 });
  audit(
    58,
    demo.daniel,
    "ROLE_CHANGED",
    "User",
    demo.grace,
    { titles: ["TEAM_LEAD"] },
    { titles: ["TEAM_LEAD", "MARSHAL"] },
  );
  audit(55, demo.funke, "USER_APPROVED", "User", recentApproved[0] ?? demo.tobi);
  audit(
    47,
    demo.daniel,
    "USER_SUSPENDED",
    "User",
    demo.victor,
    { status: "ACTIVE" },
    { status: "SUSPENDED", reason: "Repeated no-shows without contact" },
  );
  audit(
    44,
    demo.daniel,
    "MEETING_CANCELLED",
    "Meeting",
    "mtg-2026-08-15-sat",
    { status: "SCHEDULED" },
    { status: "CANCELLED" },
  );
  audit(40, demo.esther, "EXCUSE_APPROVED", "ExcuseRequest", "exc-01");
  audit(36, demo.joshua, "MESSAGE_SENT", "Message", "msg-03");
  audit(
    30,
    demo.esther,
    "ATTENDANCE_CORRECTED",
    "AttendanceRecord",
    manualPick[0]?.id ?? null,
    { status: "ABSENT" },
    { status: "ON_TIME", reason: "Marshal confirmed presence" },
  );
  audit(26, demo.daniel, "INVITE_SENT", "Invite", "inv-0");
  audit(25, demo.funke, "USER_APPROVED", "User", recentApproved[1] ?? demo.tobi);
  audit(21, demo.funke, "USER_APPROVED", "User", demo.tobi);
  audit(20, demo.joshua, "ANNOUNCEMENT_POSTED", "Announcement", "ann-2");
  audit(18, demo.esther, "EXCUSE_DECLINED", "ExcuseRequest", "exc-05");
  audit(14, demo.esther, "UPLOAD_CONFIRMED", "AttendanceUpload", "upl-2026-10-22");
  audit(12, demo.funke, "DUTIES_PUBLISHED", "DutyAssignment", "mtg-2026-11-07-sat");
  audit(10, demo.joshua, "MESSAGE_SENT", "Message", "msg-07");
  audit(9, demo.daniel, "ROLE_CHANGED", "User", demo.michael, { titles: [] }, { titles: ["SUPPLIES_KEEPER"] });
  audit(8, demo.naomi, "REPORT_DOWNLOADED", "Report", "attendance-register-2026-10");
  audit(7, demo.esther, "UPLOAD_CONFIRMED", "AttendanceUpload", "upl-2026-10-29");
  audit(6, demo.joshua, "MESSAGE_SENT", "Message", "msg-04");
  audit(5, demo.daniel, "ANNOUNCEMENT_POSTED", "Announcement", "ann-1");
  audit(4, demo.daniel, "INVITE_SENT", "Invite", "inv-1");
  audit(3, demo.esther, "REPORT_DOWNLOADED", "Report", "member-summary-q3");
  audit(1, demo.funke, "ISSUE_UPDATED", "IssueReport", "iss-06", { status: "OPEN" }, { status: "IN_PROGRESS" });
  audit(0, demo.esther, "UPLOAD_PREVIEWED", "AttendanceUpload", "upl-2026-11-05");
  auditLogs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    users,
    userTitles,
    zones,
    teams,
    teamMembers,
    venues: [venue],
    meetings,
    records,
    uploads,
    uploadRows,
    excuses,
    notifications,
    messages,
    messageRecipients,
    announcements,
    rsvps,
    duties,
    serviceHours,
    issues,
    badges,
    userBadges,
    invites,
    auditLogs,
    settings: { ...DEFAULT_SETTINGS },
    demo,
    sampleSheets: { clean: cleanRows, withErrors },
  };
}
