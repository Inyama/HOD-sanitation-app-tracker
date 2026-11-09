// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { createJsonMockRepository } from "@/lib/repo/json-mock";
import { buildSeed } from "@/data/seed";
import { authStore, resetAuthStore } from "@/lib/auth/store";
import { acceptInvite } from "@/lib/auth/service";
import {
  addMember,
  bulkMembers,
  changeRole,
  decideDeletion,
  decideSignup,
  importMembers,
  inviteAdmin,
  removeMember,
  sendDirectMessage,
  setMemberStatus,
  updateSettings,
  type AdminContext,
} from "@/lib/admin/service";
import type { Repository } from "@/lib/repo/interfaces";
import type { SettingsBody } from "@/lib/validation/admin";

const seed = buildSeed();
const NOW = DateTime.fromISO("2026-11-09T10:00:00Z");
let repo: Repository;
let superCtx: AdminContext;
let unitCtx: AdminContext;

const audits = async (action: string) => (await repo.audit.list()).filter((a) => a.action === action);

beforeEach(async () => {
  repo = createJsonMockRepository(seed);
  resetAuthStore();
  superCtx = { admin: (await repo.users.get(seed.demo.daniel))!, ip: "10.0.0.1", now: NOW };
  unitCtx = { admin: (await repo.users.get(seed.demo.funke))!, ip: "10.0.0.2", now: NOW };
});

describe("approvals", () => {
  it("approves a pending sign-up: active, audited, emailed and notified", async () => {
    const r = await decideSignup(repo, unitCtx, seed.demo.samuel, { approve: true });
    expect(r.ok).toBe(true);
    const u = (await repo.users.get(seed.demo.samuel))!;
    expect(u.status).toBe("ACTIVE");
    expect(u.approvedAt).toBe(NOW.toISO());
    const [a] = await audits("USER_APPROVED").then((xs) => xs.filter((x) => x.entityId === u.id));
    expect(a).toMatchObject({ actorId: seed.demo.funke, ip: "10.0.0.2" });
    expect(authStore().outbox[0]).toMatchObject({ to: u.email, kind: "ACCOUNT_APPROVED" });
    expect(await repo.notifications.count({ where: { userId: u.id, type: "ACCOUNT_APPROVED" } })).toBe(1);
    expect((await decideSignup(repo, unitCtx, u.id, { approve: true })).ok).toBe(false);
  });

  it("declines with a reason the sign-in screen recognises", async () => {
    await decideSignup(repo, unitCtx, seed.demo.samuel, { approve: false, reason: "Not in the unit" });
    const u = (await repo.users.get(seed.demo.samuel))!;
    expect(u.status).toBe("REMOVED");
    expect(u.statusReason).toBe("Rejected: Not in the unit");
  });
});

describe("members", () => {
  it("adds a member who gets a set-password email, and refuses a taken email", async () => {
    const r = await addMember(repo, unitCtx, {
      name: "Kunle  Adewale",
      email: "kunle@example.com",
      phone: null,
      role: "VOLUNTEER",
      city: "Lagos",
      country: "Nigeria",
      isRemote: false,
      teamId: "team-kitchen",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = (await repo.users.get(r.user.id))!;
    expect(u).toMatchObject({ name: "Kunle Adewale", status: "ACTIVE", role: "VOLUNTEER" });
    expect(await repo.teamMembers.findFirst({ userId: u.id })).toMatchObject({ teamId: "team-kitchen" });
    expect(authStore().outbox[0].kind).toBe("WELCOME_ADDED");
    expect(authStore().outbox[0].text).toContain("/reset-password/");
    const again = await addMember(repo, unitCtx, { name: "X Y", email: "kunle@example.com", role: "MEMBER" });
    expect(again).toMatchObject({ ok: false, code: "EMAIL_IN_USE" });
  });

  it("suspends, reactivates, removes and restores, with guards", async () => {
    const id = seed.demo.chioma;
    expect((await setMemberStatus(repo, unitCtx, id, { action: "suspend", reason: "Testing" })).ok).toBe(true);
    expect((await setMemberStatus(repo, unitCtx, id, { action: "suspend", reason: "Again" })).ok).toBe(false);
    expect((await setMemberStatus(repo, unitCtx, id, { action: "reactivate" })).ok).toBe(true);
    expect((await removeMember(repo, unitCtx, id, "Moved away")).ok).toBe(true);
    expect((await repo.users.get(id))!.status).toBe("REMOVED");
    expect(await setMemberStatus(repo, unitCtx, id, { action: "restore" })).toMatchObject({
      ok: true,
      status: "ACTIVE",
    });
    // Admins cannot act on themselves, and only a Super Admin can act on another admin.
    expect(await removeMember(repo, unitCtx, seed.demo.funke, "Oops")).toMatchObject({ code: "SELF" });
    expect(await removeMember(repo, unitCtx, seed.demo.esther, "Oops")).toMatchObject({ code: "NEEDS_SUPER" });
  });

  it("assigns a team to several people, skipping admins for a Unit Admin", async () => {
    const r = await bulkMembers(repo, unitCtx, {
      action: "assignTeam",
      ids: [seed.demo.adebayo, seed.demo.daniel],
      teamId: "team-outdoors",
    });
    expect(r.ok && r.done).toEqual(["Adebayo Johnson"]);
    expect(r.ok && r.skipped).toHaveLength(1);
    expect(await audits("TEAM_ASSIGNED")).toHaveLength(1);
  });

  it("imports only valid rows, and only when asked to commit", async () => {
    const csv = "name,email,role\nAda Obi,ada@example.com,member\nBad,not-email,member\n";
    const preview = await importMembers(repo, unitCtx, csv, false);
    expect(preview.ok && preview.rows).toHaveLength(1);
    expect(await repo.users.findFirst({ email: "ada@example.com" })).toBeNull();
    const done = await importMembers(repo, unitCtx, csv, true);
    expect(done.ok && "created" in done && done.created).toBe(1);
    expect(await repo.users.findFirst({ email: "ada@example.com" })).not.toBeNull();
  });

  it("confirms or declines a deletion request", async () => {
    await repo.users.update(seed.demo.adebayo, { deletionRequestedAt: NOW.minus({ days: 1 }).toISO()! });
    await decideDeletion(repo, unitCtx, seed.demo.adebayo, false);
    expect((await repo.users.get(seed.demo.adebayo))!.deletionRequestedAt).toBeNull();
    await repo.users.update(seed.demo.adebayo, { deletionRequestedAt: NOW.toISO()! });
    await decideDeletion(repo, unitCtx, seed.demo.adebayo, true);
    expect((await repo.users.get(seed.demo.adebayo))!).toMatchObject({ status: "REMOVED" });
  });
});

describe("roles", () => {
  it("makes a member a volunteer marshal, with titles, audit and notice", async () => {
    const r = await changeRole(repo, unitCtx, seed.demo.adebayo, {
      role: "VOLUNTEER",
      adminLevel: null,
      titles: ["MARSHAL"],
    });
    expect(r.ok).toBe(true);
    expect((await repo.users.get(seed.demo.adebayo))!.role).toBe("VOLUNTEER");
    expect((await repo.userTitles.list({ where: { userId: seed.demo.adebayo } })).map((t) => t.title)).toEqual([
      "MARSHAL",
    ]);
    expect(authStore().outbox[0].kind).toBe("ROLE_CHANGED");
  });

  it("frees upcoming duties when a volunteer stops volunteering", async () => {
    const before = await repo.duties.count({ where: { userId: seed.demo.grace } });
    expect(before).toBeGreaterThan(0);
    await changeRole(repo, superCtx, seed.demo.grace, { role: "MEMBER", adminLevel: null, titles: [] });
    const left = await repo.duties.list({ where: { userId: seed.demo.grace } });
    const meetings = new Map((await repo.meetings.list()).map((m) => [m.id, m]));
    expect(left.every((d) => DateTime.fromISO(meetings.get(d.meetingId)!.startsAt) <= NOW || d.status === "DONE")).toBe(
      true,
    );
    expect((await repo.userTitles.list({ where: { userId: seed.demo.grace } })).length).toBe(0);
  });

  it("keeps admin-level changes for Super Admins and keeps one Super Admin", async () => {
    expect(
      await changeRole(repo, unitCtx, seed.demo.esther, { role: "ADMIN", adminLevel: "UNIT", titles: [] }),
    ).toMatchObject({ code: "NEEDS_SUPER" });
    expect(
      await changeRole(repo, superCtx, seed.demo.esther, { role: "ADMIN", adminLevel: "UNIT", titles: [] }),
    ).toMatchObject({ ok: true });
    expect(
      await changeRole(repo, superCtx, seed.demo.daniel, { role: "ADMIN", adminLevel: "UNIT", titles: [] }),
    ).toMatchObject({ code: "SELF" });
  });

  it("promotes an existing member through an invitation", async () => {
    const inv = await inviteAdmin(repo, superCtx, "member@hod-demo.example.com", "AUDITOR");
    expect(inv).toMatchObject({ ok: true, existing: true });
    const url = authStore().outbox[0].text.match(/accept-invite\/([\w-]+)/)!;
    const r = await acceptInvite(
      repo,
      {
        token: url[1],
        name: "Adebayo Johnson",
        password: "A-long-password-2026",
        secret: "JBSWY3DPEHPK3PXP",
        code: "123456",
      },
      { ip: "10.0.0.3", deviceId: null, userAgent: null },
    );
    expect(r.ok).toBe(true);
    expect((await repo.users.get(seed.demo.adebayo))!).toMatchObject({ role: "ADMIN", adminLevel: "AUDITOR" });
    expect(await inviteAdmin(repo, superCtx, "admin@hod-demo.example.com", "UNIT")).toMatchObject({
      code: "ALREADY_ADMIN",
    });
  });
});

describe("settings and messages", () => {
  const body = async (): Promise<SettingsBody> => {
    const s = await repo.settings.get();
    const v = (await repo.venues.get(s.venueId))!;
    return {
      venue: { name: v.name, address: v.address, lat: v.lat, lng: v.lng, radiusM: v.radiusM, verified: v.verified },
      maxAccuracyM: s.maxAccuracyM,
      graceMinutes: s.graceMinutes,
      openBeforeMinutes: s.openBeforeMinutes,
      closeAfterMinutes: s.closeAfterMinutes,
      lateWeight: s.lateWeight,
      bandThresholds: s.bandThresholds,
      atRiskPercent: s.atRiskPercent,
      atRiskConsecutiveAbsences: s.atRiskConsecutiveAbsences,
      lowAttendancePercent: s.lowAttendancePercent,
      quietHours: s.quietHours,
      locationRetentionMonths: s.locationRetentionMonths,
      timezone: s.timezone,
      branding: s.branding,
    };
  };

  it("saves settings and the venue, auditing only what changed", async () => {
    const b = await body();
    expect(await updateSettings(repo, superCtx, b)).toMatchObject({ code: "NO_CHANGE" });
    const r = await updateSettings(repo, superCtx, { ...b, lateWeight: 0.5, venue: { ...b.venue, radiusM: 150 } });
    expect(r.ok && r.changes).toEqual(["Late weight", "Geofence radius (m)"]);
    expect((await repo.settings.get()).lateWeight).toBe(0.5);
    expect((await repo.venues.get("venue-main"))!.radiusM).toBe(150);
    const [a] = (await audits("SETTINGS_UPDATED")).slice(-1);
    expect(a.before).toEqual({ lateWeight: 1, "venue.radiusM": 100 });
    expect(a.after).toEqual({ lateWeight: 0.5, "venue.radiusM": 150 });
  });

  it("sends a direct message to active people only, with first names filled in", async () => {
    const r = await sendDirectMessage(repo, unitCtx, {
      userIds: [seed.demo.chioma, seed.demo.victor],
      subject: "We miss you",
      body: "Hello {first_name}, see you on Saturday.",
    });
    expect(r).toMatchObject({ ok: true, recipients: 1 });
    const n = await repo.notifications.findFirst({ userId: seed.demo.chioma, type: "MESSAGE" });
    expect(n!.body).toBe("Hello Chioma, see you on Saturday.");
  });
});
