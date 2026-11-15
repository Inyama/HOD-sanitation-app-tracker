// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { createJsonMockRepository } from "@/lib/repo/json-mock";
import { buildSeed } from "@/data/seed";
import { authStore, resetAuthStore } from "@/lib/auth/store";
import type { Repository } from "@/lib/repo/interfaces";
import type { OpsContext } from "@/lib/admin/ops-common";
import { confirmUpload, createPreview, previewDetails, resolveRow, rollbackUpload } from "@/lib/admin/ops-uploads";
import { cancelMeeting, createMeetings, rescheduleMeeting } from "@/lib/admin/ops-meetings";
import { decideExcuse } from "@/lib/admin/ops-excuses";
import { correctRecord, createDispute, decideDispute, reviewFlag } from "@/lib/admin/ops-corrections";
import { assignDuty, loadRoster, publishRoster } from "@/lib/admin/ops-roster";
import { reportFile } from "@/lib/admin/ops-reports";
import { cancelScheduled, sendMessage } from "@/lib/admin/ops-messages";
import { sendTest, updateAutomation } from "@/lib/admin/ops-automation";
import { closeMeeting } from "@/lib/attendance/close-service";
import { resetSchedulerState, runScheduler } from "@/lib/notifications/runner";
import { loadPeopleFacts } from "@/lib/notifications/context";

const seed = buildSeed();
const lagos = (iso: string) => DateTime.fromISO(iso, { zone: "Africa/Lagos" }).toUTC();
const NOW = lagos("2026-11-09T11:00");
let repo: Repository;
let admin: OpsContext;
let officer: OpsContext;

const audits = async (action: string) => (await repo.audit.list()).filter((a) => a.action === action);

beforeEach(async () => {
  repo = createJsonMockRepository(seed);
  resetAuthStore();
  resetSchedulerState();
  admin = { admin: (await repo.users.get(seed.demo.daniel))!, ip: "10.0.0.1", now: NOW };
  officer = { admin: (await repo.users.get(seed.demo.esther))!, ip: "10.0.0.3", now: NOW };
});

describe("sheet upload (spec 6.4 and 15)", () => {
  const PREVIEW = "upl-2026-11-05";

  it("the seeded preview has the three planted exceptions and needs the suggestion decided", async () => {
    const d = (await previewDetails(repo, PREVIEW))!;
    const byType = (t: string) => d.rows.filter((r) => r.matchType === t);
    expect(byType("NAME_SUGGESTED").map((r) => r.name)).toContain("Adebayo Jonhson");
    expect(byType("NOT_FOUND")).toHaveLength(1);
    expect(byType("DUPLICATE")).toHaveLength(1);
    expect(d.undecided).toBe(1);
    const blocked = await confirmUpload(repo, officer, PREVIEW, false);
    expect(blocked).toMatchObject({ ok: false, code: "NEEDS_DECISIONS" });
  });

  it("confirms, replaces on re-upload without double counting, and rollback restores the earlier sheet", async () => {
    const d = (await previewDetails(repo, PREVIEW))!;
    const suggested = d.rows.find((r) => r.matchType === "NAME_SUGGESTED")!;
    expect((await resolveRow(repo, officer, PREVIEW, suggested.id, { kind: "ACCEPT" })).ok).toBe(true);
    const unknown = d.rows.find((r) => r.matchType === "NOT_FOUND")!;
    expect((await resolveRow(repo, officer, PREVIEW, unknown.id, { kind: "IGNORE" })).ok).toBe(true);
    const first = await confirmUpload(repo, officer, PREVIEW, false);
    expect(first.ok).toBe(true);
    const meetingId = d.meeting.id;
    const afterFirst = await repo.records.list({ where: { meetingId } });
    const people = new Set(afterFirst.map((r) => r.userId));
    expect(people.size).toBe(afterFirst.length); // one record per person
    expect(afterFirst.find((r) => r.userId === seed.demo.adebayo)?.status).toMatch(/ON_TIME|LATE/);

    // Upload the clean sheet for the same meeting.
    const csv = readFileSync(path.join(process.cwd(), "src/data/sample-sheets/thursday-clean.csv"));
    const second = await createPreview(repo, officer, {
      meetingId,
      name: "thursday-clean.csv",
      size: csv.length,
      data: csv.toString("base64"),
    });
    expect(second.ok).toBe(true);
    const secondId = (second as { uploadId: string }).uploadId;
    expect(await confirmUpload(repo, officer, secondId, false)).toMatchObject({
      ok: false,
      code: "NEEDS_REPLACE_CONFIRM",
    });
    expect((await confirmUpload(repo, officer, secondId, true)).ok).toBe(true);
    const afterSecond = await repo.records.list({ where: { meetingId } });
    expect(new Set(afterSecond.map((r) => r.userId)).size).toBe(afterSecond.length);
    expect(afterSecond.every((r) => r.method !== "SHEET" || r.sourceUploadId === secondId)).toBe(true);
    expect((await repo.uploads.get(PREVIEW))!.status).toBe("ROLLED_BACK");

    const rb = await rollbackUpload(repo, officer, secondId);
    expect(rb.ok).toBe(true);
    const restored = await repo.records.list({ where: { meetingId } });
    expect(restored.map((r) => `${r.userId}:${r.status}`).sort()).toEqual(
      afterFirst.map((r) => `${r.userId}:${r.status}`).sort(),
    );
    expect((await repo.uploads.get(PREVIEW))!.status).toBe("CONFIRMED");
    expect(await audits("UPLOAD_ROLLED_BACK")).toHaveLength(1);
  });
});

describe("meetings", () => {
  it("cancelling notifies people, never counts, and removes its reminders", async () => {
    const r = await cancelMeeting(repo, admin, "mtg-2026-11-14-sat", "The hall is being painted");
    expect(r.ok).toBe(true);
    const m = (await repo.meetings.get("mtg-2026-11-14-sat"))!;
    expect(m.status).toBe("CANCELLED");
    expect(m.statusNote).toContain("painted.");
    expect((r as { told: number }).told).toBeGreaterThan(30);
    expect(await repo.notifications.count({ where: { type: "MEETING_CANCELLED" } })).toBe((r as { told: number }).told);
    expect(authStore().outbox.some((e) => e.kind === "MEETING_CANCELLED")).toBe(true);
    // Friday 9:30 reminder for a cancelled meeting is never sent.
    await runScheduler(repo, lagos("2026-11-13T09:30"), "cron");
    expect(
      await repo.notifications.count({
        where: { type: "SAT_DAY_BEFORE", dedupeKey: `${seed.demo.adebayo}:mtg-2026-11-14-sat:SAT_DAY_BEFORE:IN_APP` },
      }),
    ).toBe(0);
    expect((await cancelMeeting(repo, admin, "mtg-2026-10-31-sat", "Too late")).ok).toBe(false);
  });

  it("rescheduling moves the reminders to the new time", async () => {
    const r = await rescheduleMeeting(repo, admin, "mtg-2026-11-14-sat", {
      date: "2026-11-15",
      time: "10:00",
      reason: "Wedding in the hall",
    });
    expect(r.ok).toBe(true);
    await runScheduler(repo, lagos("2026-11-13T09:30"), "cron");
    expect(await repo.notifications.count({ where: { type: "SAT_DAY_BEFORE" } })).toBe(
      seed.notifications.filter((n) => n.type === "SAT_DAY_BEFORE").length,
    );
    await runScheduler(repo, lagos("2026-11-14T10:00"), "cron");
    const key = `${seed.demo.adebayo}:mtg-2026-11-14-sat:SAT_DAY_BEFORE:IN_APP`;
    expect(await repo.notifications.count({ where: { dedupeKey: key } })).toBe(1);
  });

  it("creates special events and refuses a week that already has the meeting", async () => {
    const body = {
      type: "SPECIAL" as const,
      title: "Window Day",
      date: "2026-11-20",
      time: "08:00",
      durationMin: 180,
      method: "GEO" as const,
      openBeforeMin: 30,
      closeAfterMin: 120,
      graceMinutes: 5,
      radiusM: 150,
      requireQr: false,
      repeatWeeks: 2,
    };
    const r = await createMeetings(repo, admin, body);
    expect(r.ok && r.ids).toHaveLength(2);
    expect((await repo.meetings.get((r as { ids: string[] }).ids[0]))!.radiusM).toBe(150);
    await cancelMeeting(repo, admin, "mtg-2026-11-21-sat", "x reason");
    const clash = await createMeetings(repo, admin, {
      ...body,
      type: "SATURDAY",
      title: "Saturday",
      date: "2026-11-21",
      time: "09:30",
      repeatWeeks: 1,
    });
    expect(clash).toMatchObject({ ok: false, code: "CLASH" });
  });
});

describe("excuses, corrections and disputes", () => {
  it("an approved excuse turns Absent into Excused and raises the percentage", async () => {
    const before = (await loadPeopleFacts(repo, NOW)).facts.get(seed.demo.chioma)!.percent!;
    const r = await decideExcuse(repo, officer, "exc-07", "APPROVED", "Get well soon");
    expect(r).toMatchObject({ ok: true, recordStatus: "EXCUSED" });
    const after = (await loadPeopleFacts(repo, NOW)).facts.get(seed.demo.chioma)!.percent!;
    expect(after).toBeGreaterThan(before);
    expect((await decideExcuse(repo, officer, "exc-07", "DECLINED", "again")).ok).toBe(false);
    expect(await audits("EXCUSE_APPROVED")).toHaveLength(2); // one seeded, one now
  });

  it("a declined excuse keeps Absent", async () => {
    await decideExcuse(repo, officer, "exc-08", "DECLINED", "Please tell your lead earlier");
    const e = (await repo.excuses.get("exc-08"))!;
    const rec = await repo.records.findFirst({ meetingId: e.meetingId, userId: e.userId });
    expect(rec?.status).toBe("ABSENT");
  });

  it("a correction needs a reason and the audit keeps before and after", async () => {
    const flagged = (await repo.records.list()).find((r) => r.flagged && r.method === "GEO")!;
    const res = await correctRecord(repo, officer, flagged.id, {
      status: "ABSENT",
      reason: "Shared phone, not present",
    });
    expect(res.ok).toBe(true);
    const [a] = await audits("ATTENDANCE_CORRECTED").then((x) =>
      x.filter((y) => y.entityId === flagged.id && y.actorId === officer.admin.id),
    );
    expect(a.before).toMatchObject({ status: flagged.status, flagged: true });
    expect(a.after).toMatchObject({ status: "ABSENT", flagged: false, reason: "Shared phone, not present" });
    expect((await reviewFlag(repo, officer, flagged.id, undefined)).ok).toBe(false);
  });

  it("disputes: accepting corrects the record; members can raise one", async () => {
    const r = await decideDispute(repo, officer, "dsp-01", {
      accept: true,
      status: "LATE",
      arrivedAt: "09:45",
      note: "Marshal confirmed",
    });
    expect(r.ok).toBe(true);
    const d = (await repo.disputes.get("dsp-01"))!;
    expect(d.status).toBe("RESOLVED");
    const rec = await repo.records.findFirst({ meetingId: d.meetingId, userId: d.userId });
    expect(rec).toMatchObject({ status: "LATE", method: "MANUAL" });
    const user = (await repo.users.get(seed.demo.chioma))!;
    const own = await createDispute(repo, user, NOW, {
      meetingId: "mtg-2026-11-07-sat",
      claimed: "ON_TIME",
      message: "I was there early with my team.",
    });
    expect(own.ok).toBe(true);
  });
});

describe("closing meetings and the roster", () => {
  it("closing a held Saturday writes absentees once", async () => {
    const m =
      (await repo.meetings.get("mtg-2026-11-07-sat")) ??
      (await repo.meetings.create({ ...(await repo.meetings.list())[0], id: "mtg-2026-11-07-sat" }));
    const res = await closeMeeting(repo, { ...m, status: "SCHEDULED" }, NOW, admin.admin.id);
    expect(res.closed).toBe(true);
    const n = await repo.records.count({ where: { meetingId: m.id } });
    const again = await closeMeeting(repo, (await repo.meetings.get(m.id))!, NOW, admin.admin.id);
    expect(again.closed).toBe(false);
    expect(await repo.records.count({ where: { meetingId: m.id } })).toBe(n);
  });

  it("assigns, refuses a full zone, and publishes with each volunteer's arrival time", async () => {
    const r = await loadRoster(repo, NOW);
    const zone = r.zones.find((z) => z.name === "Kitchen")!;
    const free = r.volunteers.filter((v) => !r.current.some((c) => c.userId === v.id));
    for (const v of free.slice(0, zone.capacity)) await assignDuty(repo, admin, r.meeting!.id, v.id, zone.id);
    const now = await loadRoster(repo, NOW, r.meeting!.id);
    const inKitchen = now.current.filter((c) => c.zoneId === zone.id && c.status !== "SWAPPED").length;
    expect(inKitchen).toBeGreaterThanOrEqual(zone.capacity);
    const extra = free[zone.capacity] ?? free.at(-1)!;
    if (inKitchen >= zone.capacity)
      expect((await assignDuty(repo, admin, r.meeting!.id, extra.id, zone.id)).ok).toBe(false);
    const pub = await publishRoster(repo, admin, r.meeting!.id);
    expect(pub.ok).toBe(true);
    expect(await repo.notifications.count({ where: { type: "DUTY_ROSTER" } })).toBeGreaterThan(0);
    expect((await repo.meetings.get(r.meeting!.id))!.rosterPublishedAt).toBe(NOW.toISO());
  });
});

describe("reports", () => {
  it("files really generate and every download is audited", async () => {
    const f = { meetingType: "ALL" as const, teamId: "ALL", userId: null };
    const seeded = (await audits("REPORT_DOWNLOADED")).length;
    const csv = await reportFile(repo, officer, "MEMBER_SUMMARY", "12w", f, "csv");
    expect(String(csv.body)).toContain("Member summary");
    const xlsx = await reportFile(repo, officer, "REGISTER", "12w", f, "xlsx");
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe("PK");
    const pdf = await reportFile(repo, officer, "LEADERSHIP", "month", f, "pdf");
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await audits("REPORT_DOWNLOADED")).toHaveLength(seeded + 3);
  }, 60_000);
});

describe("messages and automation (spec 15)", () => {
  it("a message to a percentage band reaches exactly those people, and the log lists each one", async () => {
    const comms = { ...admin, admin: (await repo.users.get(seed.demo.joshua))! };
    const pf = await loadPeopleFacts(repo, NOW);
    const amber = [...pf.facts.values()]
      .filter((f) => f.user.status === "ACTIVE" && f.bandKey === "amber")
      .map((f) => f.user.id)
      .sort();
    const r = await sendMessage(repo, comms, {
      audience: { kind: "BAND", band: "amber" },
      subject: "Hello {first_name}",
      body: "Your attendance is {percentage} percent.",
      channels: ["IN_APP", "EMAIL"],
    });
    expect(r.ok).toBe(true);
    const id = (r as { messageId: string }).messageId;
    const recipients = (await repo.messageRecipients.list({ where: { messageId: id } })).map((x) => x.userId).sort();
    expect(recipients).toEqual(amber);
    const chioma = await repo.notifications.findFirst({
      userId: seed.demo.chioma,
      type: "MESSAGE",
      dedupeKey: `${seed.demo.chioma}:${id}:MESSAGE:IN_APP`,
    });
    expect(amber.includes(seed.demo.chioma) ? chioma?.title : "skip").toBe(
      amber.includes(seed.demo.chioma) ? "Hello Chioma" : "skip",
    );
    expect(await repo.deliveries.count({ where: { messageId: id, channel: "IN_APP" } })).toBe(amber.length);
  });

  it("scheduled messages wait for the scheduler, and can be cancelled", async () => {
    const r = await sendMessage(repo, admin, {
      audience: { kind: "ALL_VOLUNTEERS" },
      subject: "Briefing",
      body: "See you at 8 am for the briefing.",
      channels: ["IN_APP"],
      scheduledFor: "2026-11-09T15:00",
    });
    expect(r).toMatchObject({ ok: true, scheduled: true });
    const id = (r as { messageId: string }).messageId;
    expect(await repo.messageRecipients.count({ where: { messageId: id } })).toBe(0);
    await runScheduler(repo, lagos("2026-11-09T15:00"), "cron");
    expect((await repo.messages.get(id))!.sentAt).not.toBeNull();
    expect(await repo.messageRecipients.count({ where: { messageId: id } })).toBeGreaterThan(5);
    const later = await sendMessage(repo, admin, {
      audience: { kind: "EVERYONE" },
      subject: "Later",
      body: "Something for later.",
      channels: ["IN_APP"],
      scheduledFor: "2026-11-20T10:00",
    });
    expect((await cancelScheduled(repo, admin, (later as { messageId: string }).messageId)).ok).toBe(true);
  });

  it("reminders fire exactly once; the late notice reaches only people not checked in", async () => {
    const at = (iso: string) => runScheduler(repo, lagos(iso), "cron");
    const fri = await at("2026-11-13T09:30");
    expect(fri.reminders).toBeGreaterThan(30);
    expect((await at("2026-11-13T09:30")).reminders).toBe(0);
    // Adebayo checks in before 9:30 on Saturday.
    const sat =
      (await repo.meetings.get("mtg-2026-11-14-sat")) ??
      (await repo.meetings.create({
        ...(await repo.meetings.list()).find((m) => m.type === "SATURDAY")!,
        id: "mtg-2026-11-14-sat",
        startsAt: lagos("2026-11-14T09:30").toISO()!,
        status: "SCHEDULED",
      }));
    await repo.records.create({
      meetingId: sat.id,
      userId: seed.demo.adebayo,
      status: "ON_TIME",
      checkedInAt: lagos("2026-11-14T09:10").toISO()!,
      method: "GEO",
      lat: null,
      lng: null,
      accuracyM: 10,
      distanceM: 20,
      deviceId: null,
      flagged: false,
      flagReason: null,
      sourceUploadId: null,
      recordedById: null,
      note: null,
    });
    await at("2026-11-14T09:30");
    const late = await repo.notifications.list({ where: { type: "SAT_LATE_NOTICE" } });
    const fresh = late.filter((n) => n.dedupeKey.includes(sat.id));
    expect(fresh.length).toBeGreaterThan(10);
    expect(fresh.some((n) => n.userId === seed.demo.adebayo)).toBe(false);
  });

  it("switched-off rules are skipped; tests go to me; failures are retried with back-off", async () => {
    expect((await updateAutomation(repo, admin, { target: "rule", type: "THU_HOUR_BEFORE", enabled: false })).ok).toBe(
      true,
    );
    const s = await runScheduler(repo, lagos("2026-11-12T19:30"), "cron");
    expect(s.reminders).toBe(0);
    const t = await sendTest(repo, admin, "SAT_HOUR_BEFORE");
    expect(t).toMatchObject({ ok: true, email: "SENT" });
    expect(authStore().outbox[0].to).toBe(admin.admin.email);
    // A failed delivery whose back-off has passed is tried again.
    const failed = await repo.deliveries.create({
      key: "k",
      userId: seed.demo.adebayo,
      type: "SAT_DAY_BEFORE",
      channel: "EMAIL",
      status: "FAILED",
      attempts: 1,
      lastError: "timeout",
      nextRetryAt: lagos("2026-11-12T19:00").toISO()!,
      createdAt: lagos("2026-11-12T18:59").toISO()!,
      sentAt: null,
      subject: "s",
      messageId: null,
      meetingId: null,
      payload: { preheader: "p", heading: "h", paragraphs: ["b"] },
    });
    const run = await runScheduler(repo, lagos("2026-11-12T19:31"), "cron");
    expect(run.retried).toBe(1);
    expect((await repo.deliveries.get(failed.id))!).toMatchObject({ status: "SENT", attempts: 2 });
  });
});
