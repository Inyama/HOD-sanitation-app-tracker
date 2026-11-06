import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("demo data and rules (Phase 1)", () => {
  test("the API serves the seed and evaluates rules at a simulated time", async ({ request }) => {
    const res = await request.get("/api/v1/demo/summary?at=2026-11-07T08:31:00Z");
    expect(res.ok()).toBe(true);
    const s = await res.json();
    expect(s.totals.people).toBe(64);
    expect(s.next.title).toBe("Saturday Sanitation Meeting");
    expect(s.next.phase).toBe("OPEN_LATE");
    const atVenue = s.next.checkIns.find((c: { preset: string }) => c.preset === "At the venue");
    expect(atVenue).toMatchObject({ ok: true, status: "LATE" });
    const far = s.next.checkIns.find((c: { preset: string }) => c.preset === "2 km away");
    expect(far).toMatchObject({ ok: false, reason: "OUT_OF_RANGE" });
    const ngozi = s.demoAccounts.find((a: { key: string }) => a.key === "ngozi");
    expect(ngozi.percent).toBe(90);
    expect(s.uploadPreview.exceptions).toHaveLength(3);
  });

  test("rejects a bad time", async ({ request }) => {
    const res = await request.get("/api/v1/demo/summary?at=not-a-date");
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("BAD_REQUEST");
  });

  test("the review page shows demo accounts and reacts to Simulate time", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/data");
    await expect(page.getByRole("heading", { level: 1, name: "Demo data and rules" })).toBeVisible();
    const accounts = page.getByRole("table", { name: "Demo accounts" });
    await expect(accounts.getByText("Adebayo Johnson")).toBeVisible();
    await expect(accounts.getByText("90.0%")).toBeVisible();
    await expect(accounts.getByText("89.7%")).toBeVisible();

    await page.getByRole("button", { name: /Sat 09:20/ }).click();
    await expect(page.getByText("Check-in open: arrivals are On time")).toBeVisible();
    await page.getByRole("button", { name: /Sat 09:31/ }).click();
    await expect(page.getByText("Check-in open: arrivals count as Late")).toBeVisible();
    await page.getByRole("button", { name: /Sat 08:25/ }).click();
    await expect(page.getByText("Check-in not open yet")).toBeVisible();
    await page.getByRole("button", { name: /Thu 19:30/ }).click();
    await expect(page.getByText("Thursday: hour before")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id);
    expect(serious).toEqual([]);
    await page.screenshot({ path: "test-results/screens/dev-data-1280.png", fullPage: false });
  });

  test("fits a 360px phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/dev/data");
    await expect(page.getByRole("list", { name: "Demo accounts" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
