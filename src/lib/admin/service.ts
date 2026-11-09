import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AppSettings, TitleCode, User } from "@/lib/repo/types";
import { ADMIN_LEVEL_LABELS, DEFAULT_NOTIF_PREFS } from "@/lib/repo/types";
import { capabilities } from "@/lib/auth/permissions";
import { actorFor } from "@/lib/auth/session";
import { hashPassword, passwordFingerprint } from "@/lib/auth/password";
import { authSecret } from "@/lib/auth/secret";
import { randomToken, sha256Hex, signToken } from "@/lib/auth/tokens";
import { accountEmail } from "@/lib/notifications/account-emails";
import { appUrl, sendBrandedEmail } from "@/lib/notifications/senders";
import { firstName } from "@/lib/notifications/templates";
import { clampRadius } from "@/lib/attendance/geofence";
import type { AddMemberBody, SettingsBody, UpdateMemberBody } from "@/lib/validation/admin";
import { canRestore, parseMemberImport, type ImportRow } from "./members";
import { checkRoleChange, normalizeAssignment, roleEffects, ROLE_CHANGE_MESSAGES, type Assignment } from "./roles";
import { changeSnapshot, settingsChanges } from "./settings";

/**
 * Admin write actions (spec 7.4). Every write is checked here, not only in the route, and
 * leaves an audit entry with the admin and their IP (spec 11, 12).
 */

export interface AdminContext {
  admin: User;
  ip: string;
  now: DateTime;
}

export type Fail = { ok: false; code: string; message: string; status: number };
const fail = (code: string, message: string, status = 400): Fail => ({ ok: false, code, message, status });

const WELCOME_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_TTL_DAYS = 7;

async function audit(
  repo: Repository,
  ctx: AdminContext,
  action: string,
  entity: string,
  entityId: string | null,
  before: unknown = null,
  after: unknown = null,
) {
  await repo.audit.append({
    actorId: ctx.admin.id,
    action,
    entity,
    entityId,
    before,
    after,
    ip: ctx.ip,
    createdAt: ctx.now.toISO()!,
  });
}

async function notify(repo: Repository, ctx: AdminContext, userId: string, type: string, title: string, body: string) {
  const at = ctx.now.toISO()!;
  await repo.notifications.create({
    userId,
    type,
    channel: "IN_APP",
    title,
    body,
    scheduledFor: at,
    sentAt: at,
    readAt: null,
    status: "SENT",
    dedupeKey: `${userId}:${type}:${at}`,
  });
}

/** Is the admin allowed to act on this person at all? Admin accounts need a Super Admin. */
async function guardTarget(repo: Repository, ctx: AdminContext, userId: string): Promise<User | Fail> {
  const target = await repo.users.get(userId);
  if (!target) return fail("NOT_FOUND", "We could not find that person.", 404);
  if (target.id === ctx.admin.id) return fail("SELF", "You cannot do this to your own account. Ask another admin.");
  if (target.role === "ADMIN") {
    const titles = (await repo.userTitles.list({ where: { userId: ctx.admin.id } })).map((t) => t.title);
    if (!capabilities(actorFor(ctx.admin, titles)).has("roles.assignAdminLevel"))
      return fail("NEEDS_SUPER", "Only a Super Admin can change another admin's account.", 403);
  }
  return target;
}

const isFail = (v: unknown): v is Fail => !!v && typeof v === "object" && (v as Fail).ok === false;

async function setTeam(repo: Repository, userId: string, teamId: string | null) {
  await repo.teamMembers.deleteMany({ userId });
  if (teamId) await repo.teamMembers.create({ teamId, userId });
}

async function teamOf(repo: Repository, userId: string): Promise<string | null> {
  return (await repo.teamMembers.findFirst({ userId }))?.teamId ?? null;
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export async function decideSignup(
  repo: Repository,
  ctx: AdminContext,
  userId: string,
  decision: { approve: true } | { approve: false; reason: string },
) {
  const target = await repo.users.get(userId);
  if (!target) return fail("NOT_FOUND", "We could not find that person.", 404);
  if (target.status !== "PENDING") return fail("NOT_PENDING", `${target.name} is not waiting for approval.`, 409);
  const at = ctx.now.toISO()!;
  if (decision.approve) {
    await repo.users.update(userId, { status: "ACTIVE", approvedAt: at, statusChangedAt: at, statusReason: null });
    await audit(repo, ctx, "USER_APPROVED", "User", userId, { status: "PENDING" }, { status: "ACTIVE" });
    await notify(
      repo,
      ctx,
      userId,
      "ACCOUNT_APPROVED",
      "Welcome to the Sanitation Unit",
      "Your account is approved. Check in when you arrive at the venue on Saturday.",
    );
    await sendBrandedEmail(
      target.email,
      "ACCOUNT_APPROVED",
      accountEmail("ACCOUNT_APPROVED", { name: target.name, url: `${appUrl()}/login` }),
    );
  } else {
    await repo.users.update(userId, {
      status: "REMOVED",
      statusChangedAt: at,
      statusReason: `Rejected: ${decision.reason}`,
    });
    await audit(
      repo,
      ctx,
      "USER_REJECTED",
      "User",
      userId,
      { status: "PENDING" },
      { status: "REMOVED", reason: decision.reason },
    );
    await sendBrandedEmail(target.email, "SIGNUP_DECLINED", accountEmail("SIGNUP_DECLINED", { name: target.name }));
  }
  return { ok: true as const, name: target.name };
}

export async function bulkApprove(repo: Repository, ctx: AdminContext, ids: string[]) {
  const approved: string[] = [];
  const skipped: { id: string; message: string }[] = [];
  for (const id of ids) {
    const r = await decideSignup(repo, ctx, id, { approve: true });
    if (r.ok) approved.push(r.name);
    else skipped.push({ id, message: r.message });
  }
  return { ok: true as const, approved, skipped };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

async function createPerson(
  repo: Repository,
  ctx: AdminContext,
  p: Pick<ImportRow, "name" | "email" | "phone" | "role" | "city" | "country" | "isRemote" | "teamId">,
) {
  const at = ctx.now.toISO()!;
  const user = await repo.users.create({
    id: `usr-${randomToken(9)}`,
    name: p.name,
    email: p.email,
    secondaryEmail: null,
    phone: p.phone,
    // Unusable until they choose a password from the welcome email.
    passwordHash: await hashPassword(randomToken(24)),
    role: p.role,
    adminLevel: null,
    status: "ACTIVE",
    isRemote: p.isRemote,
    country: p.country,
    city: p.city,
    timezone: "Africa/Lagos",
    language: "en",
    avatarUrl: null,
    totpSecret: null,
    approvedAt: at,
    lastLoginAt: null,
    notifPrefs: { ...DEFAULT_NOTIF_PREFS },
    createdAt: at,
    statusChangedAt: at,
    statusReason: null,
    // Consent is recorded when they first sign in and accept (spec 12).
    consentLocationAt: null,
    consentRemindersAt: null,
    emailVerifiedAt: null,
    signupDetails: { unitCode: null, notes: `Added by ${ctx.admin.name}` },
    deletionRequestedAt: null,
  });
  if (p.teamId) await setTeam(repo, user.id, p.teamId);
  const token = await signToken(
    {
      typ: "reset",
      sub: user.id,
      fp: passwordFingerprint(user.passwordHash),
      exp: ctx.now.toMillis() + WELCOME_TTL_MS,
    },
    authSecret(),
  );
  await sendBrandedEmail(
    user.email,
    "WELCOME_ADDED",
    accountEmail("WELCOME_ADDED", { name: user.name, url: `${appUrl()}/reset-password/${token}` }),
  );
  return user;
}

async function teamExists(repo: Repository, teamId: string | null | undefined) {
  return !teamId || !!(await repo.teams.get(teamId));
}

export async function addMember(repo: Repository, ctx: AdminContext, body: AddMemberBody) {
  if (await repo.users.findFirst({ email: body.email }))
    return fail("EMAIL_IN_USE", "Someone already has an account with this email.", 409);
  if (!(await teamExists(repo, body.teamId))) return fail("NO_TEAM", "Choose a team from the list.");
  const user = await createPerson(repo, ctx, {
    name: body.name.replace(/\s+/g, " "),
    email: body.email,
    phone: body.phone ?? null,
    role: body.role,
    city: body.city ?? null,
    country: body.country ?? null,
    isRemote: body.isRemote ?? false,
    teamId: body.teamId ?? null,
  });
  await audit(repo, ctx, "USER_ADDED", "User", user.id, null, {
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: body.teamId ?? null,
  });
  return { ok: true as const, user: { id: user.id, name: user.name } };
}

export async function importMembers(repo: Repository, ctx: AdminContext, csv: string, commit: boolean) {
  const [users, teams] = await Promise.all([repo.users.list(), repo.teams.list()]);
  const preview = parseMemberImport(csv, {
    existingEmails: new Set(users.map((u) => u.email.toLowerCase())),
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
  });
  if (preview.fatal) return fail("BAD_FILE", preview.fatal, 422);
  if (!commit) return { ok: true as const, committed: false, ...preview };
  if (preview.rows.length === 0) return fail("NOTHING_TO_IMPORT", "There are no valid rows to import.", 422);
  const created = await repo.transaction(async (tx) => {
    const ids: string[] = [];
    for (const row of preview.rows) ids.push((await createPerson(tx, ctx, row)).id);
    return ids;
  });
  await audit(repo, ctx, "USER_IMPORTED", "User", null, null, {
    count: created.length,
    skippedRows: preview.errors.length ? [...new Set(preview.errors.map((e) => e.line))] : [],
  });
  return { ok: true as const, committed: true, ...preview, created: created.length };
}

export async function updateMember(repo: Repository, ctx: AdminContext, userId: string, patch: UpdateMemberBody) {
  const target = await guardTarget(repo, ctx, userId);
  if (isFail(target)) return target;
  if (patch.email && patch.email !== target.email && (await repo.users.findFirst({ email: patch.email })))
    return fail("EMAIL_IN_USE", "Someone already has an account with this email.", 409);
  if (!(await teamExists(repo, patch.teamId))) return fail("NO_TEAM", "Choose a team from the list.");
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const fields = ["name", "email", "phone", "city", "country", "isRemote"] as const;
  const userPatch: Partial<User> = {};
  for (const f of fields) {
    if (patch[f] === undefined) continue;
    const next = f === "name" ? (patch.name as string).replace(/\s+/g, " ") : patch[f];
    if (next === target[f]) continue;
    before[f] = target[f];
    after[f] = next;
    (userPatch as Record<string, unknown>)[f] = next;
  }
  if (patch.email && patch.email !== target.email) userPatch.emailVerifiedAt = null;
  if (patch.teamId !== undefined) {
    const current = await teamOf(repo, userId);
    if (current !== patch.teamId) {
      before.teamId = current;
      after.teamId = patch.teamId;
      await setTeam(repo, userId, patch.teamId);
    }
  }
  if (Object.keys(after).length === 0) return fail("NO_CHANGE", "Nothing has changed.");
  if (Object.keys(userPatch).length) await repo.users.update(userId, userPatch);
  await audit(repo, ctx, "USER_UPDATED", "User", userId, before, after);
  return { ok: true as const };
}

export async function setMemberStatus(
  repo: Repository,
  ctx: AdminContext,
  userId: string,
  body: { action: "suspend"; reason: string } | { action: "reactivate" } | { action: "restore" },
) {
  const target = await guardTarget(repo, ctx, userId);
  if (isFail(target)) return target;
  const at = ctx.now.toISO()!;
  if (body.action === "suspend") {
    if (target.status !== "ACTIVE") return fail("NOT_ACTIVE", `${target.name} is not active.`, 409);
    await repo.users.update(userId, { status: "SUSPENDED", statusChangedAt: at, statusReason: body.reason });
    await audit(
      repo,
      ctx,
      "USER_SUSPENDED",
      "User",
      userId,
      { status: "ACTIVE" },
      { status: "SUSPENDED", reason: body.reason },
    );
    return { ok: true as const, name: target.name, status: "SUSPENDED" as const };
  }
  if (body.action === "reactivate") {
    if (target.status !== "SUSPENDED") return fail("NOT_SUSPENDED", `${target.name} is not suspended.`, 409);
    await repo.users.update(userId, { status: "ACTIVE", statusChangedAt: at, statusReason: null });
    await audit(repo, ctx, "USER_REACTIVATED", "User", userId, { status: "SUSPENDED" }, { status: "ACTIVE" });
    await notify(
      repo,
      ctx,
      userId,
      "ACCOUNT_REACTIVATED",
      "Your account is active again",
      "Welcome back. You can sign in and check in as before.",
    );
    return { ok: true as const, name: target.name, status: "ACTIVE" as const };
  }
  if (!canRestore(target, ctx.now))
    return fail(
      "CANNOT_RESTORE",
      "This account can no longer be restored (removed more than 30 days ago, or a declined sign-up).",
      409,
    );
  const status = target.approvedAt ? "ACTIVE" : "PENDING";
  await repo.users.update(userId, { status, statusChangedAt: at, statusReason: null, deletionRequestedAt: null });
  await audit(repo, ctx, "USER_RESTORED", "User", userId, { status: "REMOVED" }, { status });
  return { ok: true as const, name: target.name, status };
}

export async function removeMember(repo: Repository, ctx: AdminContext, userId: string, reason: string) {
  const target = await guardTarget(repo, ctx, userId);
  if (isFail(target)) return target;
  if (target.status === "REMOVED") return fail("ALREADY_REMOVED", `${target.name} is already removed.`, 409);
  const at = ctx.now.toISO()!;
  await repo.users.update(userId, { status: "REMOVED", statusChangedAt: at, statusReason: reason });
  await audit(repo, ctx, "USER_REMOVED", "User", userId, { status: target.status }, { status: "REMOVED", reason });
  return { ok: true as const, name: target.name };
}

export async function bulkMembers(
  repo: Repository,
  ctx: AdminContext,
  body:
    | { action: "assignTeam"; ids: string[]; teamId: string | null }
    | { action: "suspend"; ids: string[]; reason: string },
) {
  if (body.action === "assignTeam" && !(await teamExists(repo, body.teamId)))
    return fail("NO_TEAM", "Choose a team from the list.");
  const done: string[] = [];
  const skipped: { id: string; message: string }[] = [];
  for (const id of body.ids) {
    if (body.action === "suspend") {
      const r = await setMemberStatus(repo, ctx, id, { action: "suspend", reason: body.reason });
      if (r.ok) done.push(r.name);
      else skipped.push({ id, message: r.message });
      continue;
    }
    const target = await guardTarget(repo, ctx, id);
    if (isFail(target)) {
      skipped.push({ id, message: target.message });
      continue;
    }
    const current = await teamOf(repo, id);
    if (current === body.teamId) {
      done.push(target.name);
      continue;
    }
    await setTeam(repo, id, body.teamId);
    await audit(repo, ctx, "TEAM_ASSIGNED", "User", id, { teamId: current }, { teamId: body.teamId });
    done.push(target.name);
  }
  return { ok: true as const, done, skipped };
}

export async function decideDeletion(repo: Repository, ctx: AdminContext, userId: string, confirm: boolean) {
  const target = await guardTarget(repo, ctx, userId);
  if (isFail(target)) return target;
  if (!target.deletionRequestedAt)
    return fail("NO_REQUEST", `${target.name} has not asked for their account to be deleted.`, 409);
  const at = ctx.now.toISO()!;
  if (confirm) {
    await repo.users.update(userId, {
      status: "REMOVED",
      statusChangedAt: at,
      statusReason: "Deleted at the member's request",
    });
    await audit(repo, ctx, "DELETION_CONFIRMED", "User", userId, { status: target.status }, { status: "REMOVED" });
  } else {
    await repo.users.update(userId, { deletionRequestedAt: null });
    await audit(
      repo,
      ctx,
      "DELETION_DECLINED",
      "User",
      userId,
      { deletionRequestedAt: target.deletionRequestedAt },
      null,
    );
    await notify(
      repo,
      ctx,
      userId,
      "DELETION_KEPT",
      "About your deletion request",
      "A unit admin will contact you about your request before your account is deleted.",
    );
  }
  return { ok: true as const, name: target.name };
}

export async function addNote(repo: Repository, ctx: AdminContext, userId: string, body: string) {
  const target = await repo.users.get(userId);
  if (!target) return fail("NOT_FOUND", "We could not find that person.", 404);
  const note = await repo.memberNotes.create({ userId, authorId: ctx.admin.id, body, createdAt: ctx.now.toISO()! });
  // The note text stays on the profile; the audit records only that a note was written.
  await audit(repo, ctx, "NOTE_ADDED", "User", userId, null, { noteId: note.id });
  return { ok: true as const, note };
}

// ---------------------------------------------------------------------------
// Roles and titles
// ---------------------------------------------------------------------------

export async function changeRole(repo: Repository, ctx: AdminContext, userId: string, next: Assignment) {
  const target = await repo.users.get(userId);
  if (!target) return fail("NOT_FOUND", "We could not find that person.", 404);
  const [adminTitles, targetTitleRows, supers] = await Promise.all([
    repo.userTitles.list({ where: { userId: ctx.admin.id } }),
    repo.userTitles.list({ where: { userId } }),
    repo.users.count({ where: { role: "ADMIN", adminLevel: "SUPER", status: "ACTIVE" } }),
  ]);
  const before: Assignment = {
    role: target.role,
    adminLevel: target.adminLevel,
    titles: targetTitleRows.map((t) => t.title),
  };
  const editorCaps = capabilities(
    actorFor(
      ctx.admin,
      adminTitles.map((t) => t.title),
    ),
  );
  const error = checkRoleChange(
    { id: ctx.admin.id, caps: editorCaps },
    { ...before, id: userId, status: target.status },
    next,
    supers,
  );
  if (error) return fail(error, ROLE_CHANGE_MESSAGES[error], error === "NEEDS_SUPER" ? 403 : 409);

  const after = normalizeAssignment(next);
  const effects = roleEffects(before, after);
  await repo.users.update(userId, { role: after.role, adminLevel: after.adminLevel });
  for (const t of targetTitleRows) if (!after.titles.includes(t.title)) await repo.userTitles.delete(t.id);
  for (const t of effects.titlesAdded)
    await repo.userTitles.create({
      userId,
      title: t as TitleCode,
      assignedById: ctx.admin.id,
      assignedAt: ctx.now.toISO()!,
    });
  if (before.role === "VOLUNTEER" && after.role !== "VOLUNTEER") {
    // Free their upcoming duty spots so others can sign up.
    const meetings = new Map((await repo.meetings.list()).map((m) => [m.id, m]));
    for (const d of await repo.duties.list({ where: { userId } })) {
      const m = meetings.get(d.meetingId);
      if (m && DateTime.fromISO(m.startsAt) > ctx.now && d.status !== "DONE") await repo.duties.delete(d.id);
    }
  }
  await audit(repo, ctx, "ROLE_CHANGED", "User", userId, normalizeAssignment(before), after);
  await notify(repo, ctx, userId, "ROLE_CHANGED", "Your role has changed", effects.summary.join(" "));
  await sendBrandedEmail(
    target.email,
    "ROLE_CHANGED",
    accountEmail("ROLE_CHANGED", { name: target.name, lines: effects.summary, url: `${appUrl()}/login` }),
  );
  return { ok: true as const, name: target.name, effects };
}

export async function inviteAdmin(
  repo: Repository,
  ctx: AdminContext,
  email: string,
  adminLevel: NonNullable<User["adminLevel"]>,
) {
  const existing = await repo.users.findFirst({ email });
  if (existing?.role === "ADMIN") return fail("ALREADY_ADMIN", `${existing.name} is already an admin.`, 409);
  if (existing && existing.status !== "ACTIVE")
    return fail("NOT_ACTIVE", `${existing.name}'s account is not active. Approve or restore it first.`, 409);
  const token = randomToken(24);
  const invite = await repo.invites.create({
    email,
    adminLevel,
    tokenHash: await sha256Hex(token),
    expiresAt: ctx.now.plus({ days: INVITE_TTL_DAYS }).toISO()!,
    usedAt: null,
  });
  const url = `${appUrl()}/accept-invite/${token}`;
  await sendBrandedEmail(
    email,
    "ADMIN_INVITE",
    accountEmail("ADMIN_INVITE", { name: existing?.name, url, level: ADMIN_LEVEL_LABELS[adminLevel] }),
  );
  await audit(repo, ctx, "INVITE_SENT", "Invite", invite.id, null, { email, adminLevel });
  return { ok: true as const, inviteId: invite.id, existing: !!existing };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettings(repo: Repository, ctx: AdminContext, body: SettingsBody) {
  const settings = await repo.settings.get();
  const venue = (await repo.venues.get(settings.venueId)) ?? (await repo.venues.list())[0];
  if (!venue) return fail("NO_VENUE", "The venue is missing. Reset the demo data.", 500);
  const nextSettings: AppSettings = {
    ...settings,
    maxAccuracyM: body.maxAccuracyM,
    graceMinutes: body.graceMinutes,
    openBeforeMinutes: body.openBeforeMinutes,
    closeAfterMinutes: body.closeAfterMinutes,
    lateWeight: body.lateWeight,
    bandThresholds: body.bandThresholds,
    atRiskPercent: body.atRiskPercent,
    atRiskConsecutiveAbsences: body.atRiskConsecutiveAbsences,
    lowAttendancePercent: body.lowAttendancePercent,
    quietHours: body.quietHours,
    locationRetentionMonths: body.locationRetentionMonths,
    timezone: body.timezone,
    branding: body.branding,
  };
  const nextVenue = { ...body.venue, radiusM: clampRadius(body.venue.radiusM) };
  const pick = (v: typeof venue | typeof nextVenue) => ({
    name: v.name,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    radiusM: v.radiusM,
    verified: v.verified,
  });
  const changes = settingsChanges({ settings, venue: pick(venue) }, { settings: nextSettings, venue: pick(nextVenue) });
  if (changes.length === 0) return fail("NO_CHANGE", "Nothing has changed.");
  await repo.settings.update(nextSettings);
  await repo.venues.update(venue.id, nextVenue);
  const snap = changeSnapshot(changes);
  await audit(repo, ctx, "SETTINGS_UPDATED", "Setting", "settings", snap.before, snap.after);
  return { ok: true as const, changes: changes.map((c) => c.label) };
}

// ---------------------------------------------------------------------------
// Direct messages (the full Messaging center arrives in Phase 7)
// ---------------------------------------------------------------------------

export async function sendDirectMessage(
  repo: Repository,
  ctx: AdminContext,
  input: { userIds: string[]; subject: string; body: string },
) {
  const people = (await Promise.all([...new Set(input.userIds)].map((id) => repo.users.get(id)))).filter(
    (u): u is User => !!u && u.status === "ACTIVE",
  );
  if (people.length === 0) return fail("NO_RECIPIENTS", "None of the chosen people can receive messages.", 422);
  const at = ctx.now.toISO()!;
  const message = await repo.messages.create({
    senderId: ctx.admin.id,
    subject: input.subject,
    body: input.body,
    audience: { kind: "HAND_PICKED", userIds: people.map((p) => p.id) },
    channels: ["IN_APP", "EMAIL"],
    scheduledFor: null,
    sentAt: at,
  });
  for (const p of people) {
    const personal = input.body.replaceAll("{first_name}", firstName(p.name));
    await repo.messageRecipients.create({
      id: `${message.id}:${p.id}`,
      messageId: message.id,
      userId: p.id,
      deliveredAt: at,
      readAt: null,
    });
    await repo.notifications.create({
      userId: p.id,
      type: "MESSAGE",
      channel: "IN_APP",
      title: input.subject,
      body: personal.length > 160 ? `${personal.slice(0, 157)}...` : personal,
      scheduledFor: at,
      sentAt: at,
      readAt: null,
      status: "SENT",
      dedupeKey: `${p.id}:${message.id}:MESSAGE:IN_APP`,
    });
    if (p.notifPrefs.email)
      await sendBrandedEmail(p.email, "MESSAGE", {
        subject: input.subject,
        preheader: personal.slice(0, 90),
        heading: input.subject,
        paragraphs: personal.split(/\n{2,}/),
        button: { label: "Open in the app", url: `${appUrl()}/member/messages` },
      });
  }
  await audit(repo, ctx, "MESSAGE_SENT", "Message", message.id, null, {
    subject: input.subject,
    recipients: people.length,
  });
  return { ok: true as const, messageId: message.id, recipients: people.length };
}
