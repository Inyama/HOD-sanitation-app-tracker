import { describe, expect, it } from "vitest";
import { createJsonMockRepository } from "@/lib/repo/json-mock";
import { buildSeed } from "@/data/seed";
import { NotFoundError } from "@/lib/repo/interfaces";

const seed = buildSeed();

describe("json-mock repository", () => {
  it("lists with equality filters, whereIn, ordering and paging", async () => {
    const repo = createJsonMockRepository(seed);
    expect(await repo.users.count()).toBe(64);
    expect(await repo.users.count({ where: { status: "PENDING" } })).toBe(4);
    expect(await repo.users.count({ whereIn: { role: ["VOLUNTEER", "ADMIN"] } })).toBe(17);
    const firstTwo = await repo.meetings.list({ orderBy: { field: "startsAt", dir: "desc" }, limit: 2 });
    expect(firstTwo.map((m) => m.title)).toEqual(["Deep Clean Day", "Training Morning"]);
  });

  it("creates, updates and deletes, and returns copies rather than live references", async () => {
    const repo = createJsonMockRepository(seed);
    const a = await repo.announcements.create({
      title: "Test",
      body: "Body",
      pinned: false,
      authorId: seed.demo.daniel,
      createdAt: "2026-11-06T10:00:00.000Z",
    });
    a.title = "mutated outside";
    expect((await repo.announcements.get(a.id))!.title).toBe("Test");
    const u = await repo.announcements.update(a.id, { pinned: true });
    expect(u.pinned).toBe(true);
    await repo.announcements.delete(a.id);
    expect(await repo.announcements.get(a.id)).toBeNull();
    await expect(repo.announcements.update("nope", { pinned: true })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rolls back a failed transaction", async () => {
    const repo = createJsonMockRepository(seed);
    const before = await repo.records.count();
    await expect(
      repo.transaction(async (tx) => {
        await tx.records.deleteMany({ meetingId: "mtg-2026-10-31-sat" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repo.records.count()).toBe(before);
  });

  it("keeps the audit log append-only", async () => {
    const repo = createJsonMockRepository(seed);
    const entry = await repo.audit.append({
      actorId: seed.demo.daniel,
      action: "TEST",
      entity: "Test",
      entityId: null,
      before: null,
      after: null,
      ip: null,
    });
    expect(entry.id).toBeTruthy();
    expect(await repo.audit.count()).toBe(26);
    expect("update" in repo.audit).toBe(false);
    expect("delete" in repo.audit).toBe(false);
  });

  it("stores typed settings and can reset to the seed", async () => {
    const repo = createJsonMockRepository(seed);
    expect((await repo.settings.get()).graceMinutes).toBe(0);
    await repo.settings.update({ graceMinutes: 10 });
    expect((await repo.settings.get()).graceMinutes).toBe(10);
    await repo.reset();
    expect((await repo.settings.get()).graceMinutes).toBe(0);
  });
});
