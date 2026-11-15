import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test.describe.configure({ mode: "serial" });

const SUPER = "test-results/.auth-ops-super.json";

async function signInAdmin(browser: Browser, email: string, file: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login?tab=admin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Demo@2026");
  await page.getByRole("button", { name: "Sign in as admin" }).click();
  await page.getByLabel("Six-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await ctx.storageState({ path: file });
  await ctx.close();
}

async function asAdmin(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: SUPER });
  return ctx.newPage();
}

async function serious(page: Page) {
  const r = await new AxeBuilder({ page }).exclude(".leaflet-container").exclude("iframe").analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 2)
          .join(", ")}`,
    );
}

test.beforeAll(async ({ request, browser }) => {
  await request.post("/api/v1/demo/reset");
  await signInAdmin(browser, "admin@hod-demo.example.com", SUPER);
});

test("upload: resolve the error sheet's exceptions, confirm, then roll back", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/uploads");
  const card = page.getByRole("listitem").filter({ hasText: "thursday-with-errors.csv" });
  // Retry until the page has hydrated and the click opens the review step.
  await expect(async () => {
    await card.getByRole("button", { name: "Continue review" }).click();
    await expect(page.getByRole("heading", { name: "Review the matches" })).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(page.getByRole("tab", { name: /Suggested 1 \(1 to decide\)/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Not found 1/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Duplicates 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Adebayo Jonhson is Adebayo Johnson" }).click();
  await expect(page.getByText("Ready to confirm.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm attendance" }).click();
  await expect(page.getByRole("heading", { name: "Attendance saved" })).toBeVisible();
  const confirmed = page.getByRole("listitem").filter({ hasText: "thursday-with-errors.csv" });
  await expect(confirmed.getByText("Confirmed", { exact: true })).toBeVisible();
  await confirmed.getByRole("button", { name: "Roll back" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Roll back" }).click();
  await expect(page.getByText("Upload rolled back")).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "thursday-with-errors.csv" })
      .getByText("Rolled back", { exact: true }),
  ).toBeVisible();
});

test("reports: CSV, XLSX and PDF really download from the live records", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Member summary", level: 3 })).toBeVisible();
  for (const [label, ext, magic] of [
    ["CSV", "csv", "﻿Member summary"],
    ["Excel (XLSX)", "xlsx", "PK"],
    ["PDF with logo", "pdf", "%PDF-"],
  ] as const) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: label }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^hod-member-summary-.*\\.${ext}$`));
    const buf = await readFile((await download.path())!);
    expect(buf.subarray(0, Buffer.byteLength(magic)).toString()).toBe(magic);
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: /Past downloads/ })).toBeVisible();
  await expect(page.getByText("Member summary · PDF")).toBeVisible();
});

test("messaging: a message to a percentage band reaches exactly the counted people", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/messages");
  await page.getByRole("radio", { name: "A percentage band" }).click();
  const count = page.getByTestId("audience-count");
  await expect(count).toContainText(/will receive this/);
  const n = Number((await count.locator("strong").textContent())!.trim());
  expect(n).toBeGreaterThan(0);
  await page.getByRole("textbox", { name: "Subject" }).fill("A word of encouragement");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Hello {first_name}, your attendance is {percentage} percent. We would love to see you on Saturday.");
  await expect(page.getByRole("article", { name: "Message preview" })).not.toContainText("{first_name}");
  await page.getByRole("button", { name: new RegExp(`Send to ${n} ${n === 1 ? "person" : "people"}`) }).click();
  await expect(page.getByText(`Message sent to ${n} ${n === 1 ? "person" : "people"}`)).toBeVisible();
  await page.getByRole("tab", { name: /Sent and scheduled/ }).click();
  const sent = page.getByRole("listitem").filter({ hasText: "A word of encouragement" });
  await expect(sent.getByText("Band: Needs attention")).toBeVisible();
  await sent.getByRole("button", { name: /Delivery report/ }).click();
  await expect(page.getByRole("dialog").getByRole("row")).toHaveCount(n + 1);
});

test("meetings, excuses, corrections, roster and automation work end to end", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await asAdmin(browser);

  // Create a special event, then cancel it with a notice.
  await page.goto("/admin/meetings");
  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByLabel("Title").fill("Window Washing Morning");
  const d = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Date").fill(d);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Meeting created")).toBeVisible();
  await page.getByRole("button", { name: /^Cancel Window Washing Morning/ }).click();
  await page.getByLabel(/Reason/).fill("The supplier cannot deliver the ladders");
  await page.getByRole("button", { name: "Cancel meeting and notify" }).click();
  await expect(page.getByText(/Cancelled\. \d+ people were told/)).toBeVisible();

  // Approve Chioma's pending excuse.
  await page.goto("/admin/excuses");
  const chioma = page.getByRole("listitem").filter({ hasText: "Chioma Okafor" });
  await chioma.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Excuse approved for Chioma Okafor")).toBeVisible();

  // Clear a flagged check-in with a note.
  await page.goto("/admin/corrections");
  await page.getByRole("button", { name: "Looks fine, clear flag" }).first().click();
  await page.getByLabel("Note").fill("Checked with the marshal on duty");
  await page.getByRole("button", { name: "Clear flag" }).click();
  await expect(page.getByText("Flag cleared")).toBeVisible();

  // Publish the duty roster.
  await page.goto("/admin/duties");
  await expect(async () => {
    await page.getByRole("button", { name: /^Add \d+ selected$/ }).click();
    await expect(page.getByText("Suggestions added")).toBeVisible({ timeout: 3000 });
  }).toPass();
  await expect(page.getByText(/[1-9]\d* of \d+/)).toBeVisible();
  await page.getByRole("button", { name: /Publish/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Roster published")).toBeVisible();

  // Automation: switch a rule off, send a test, run the scheduler.
  await page.goto("/admin/automation");
  await page.getByRole("switch", { name: "Weekly summary enabled" }).click();
  await expect(page.getByText("Weekly summary switched off")).toBeVisible();
  await page.getByRole("button", { name: "Send test to me: Saturday: check-in is open" }).click();
  await expect(page.getByText("Test sent to you")).toBeVisible();
  await page.getByRole("button", { name: "Run the scheduler now" }).click();
  await expect(page.getByText("Scheduler ran")).toBeVisible();
  await expect(page.getByRole("region", { name: "Delivery log entries" })).toContainText("[Test]");
});

test("the live board shows counters and the list", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/live");
  await expect(page.getByRole("heading", { name: "Live Saturday board" })).toBeVisible();
  for (const label of ["Expected", "Present on time", "Late", "Not yet"])
    await expect(page.getByRole("button", { name: new RegExp(`^${label} \\d+$`) })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Live list/ })).toBeVisible();
});

test("every operations screen is accessible and fits a phone", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await asAdmin(browser);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const p of [
    "/admin/live",
    "/admin/uploads",
    "/admin/meetings",
    "/admin/excuses",
    "/admin/corrections",
    "/admin/duties",
    "/admin/reports",
    "/admin/analytics",
    "/admin/messages",
    "/admin/automation",
  ]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(p);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await serious(page), p).toEqual([]);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
        message: `${p} at 360px`,
      })
      .toBeLessThanOrEqual(0);
  }
});
