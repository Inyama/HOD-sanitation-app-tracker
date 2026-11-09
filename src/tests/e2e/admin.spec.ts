import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

test.describe.configure({ mode: "serial" });

const SUPER = "test-results/.auth-super.json";
const UNIT = "test-results/.auth-unit.json";

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

async function asAdmin(browser: Browser, file = SUPER): Promise<Page> {
  const ctx = await browser.newContext({ storageState: file });
  return ctx.newPage();
}

async function serious(page: Page) {
  const r = await new AxeBuilder({ page }).exclude(".leaflet-container").analyze();
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
  await signInAdmin(browser, "unit@hod-demo.example.com", UNIT);
});

test("the dashboard shows KPIs, charts and lists, and follows the date range", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin");
  for (const k of [
    "Active members",
    "Volunteers",
    "Average attendance",
    "On-time rate",
    "Pending approvals",
    "Open issues",
  ])
    await expect(page.getByText(k, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /At risk \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Top 10 most consistent" }).getByRole("listitem")).toHaveCount(10);
  await expect(page.getByRole("table", { name: /Number of check-ins by weekday/ })).toBeVisible();
  await page.getByRole("button", { name: /Date range: Last 12 weeks/ }).click();
  await page.getByRole("button", { name: "This year" }).click();
  await expect(page.getByText(/Figures for this year \(2026\)/)).toBeVisible();
  // The choice follows the admin to other pages and back.
  await page.goto("/admin/members");
  await expect(page.getByRole("button", { name: /Date range: This year/ })).toBeVisible();
});

test("an admin approves a member and declines another with a reason", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/approvals");
  await expect(page.getByRole("heading", { name: "Waiting for approval (4)" })).toBeVisible();
  await page.getByRole("button", { name: "Approve Samuel Bello" }).click();
  await expect(page.getByText("Samuel Bello approved")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for approval (3)" })).toBeVisible();
  await page.getByRole("button", { name: "Decline Precious Okon" }).click();
  const dialog = page.getByRole("dialog", { name: "Decline Precious Okon" });
  await dialog.getByLabel(/Reason/).fill("Not part of the Sanitation Unit");
  await dialog.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Precious Okon declined")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for approval (2)" })).toBeVisible();

  // Samuel can now sign in as a member.
  const ctx = await browser.newContext();
  const m = await ctx.newPage();
  await m.goto("/login?tab=member");
  await m.getByLabel("Email").fill("pending@hod-demo.example.com");
  await m.getByRole("textbox", { name: "Password", exact: true }).fill("Demo@2026");
  await m.getByRole("button", { name: "Sign in as member" }).click();
  await expect(m).toHaveURL(/\/member$/);

  // The audit log records both decisions.
  await page.goto("/admin/audit");
  await page.getByRole("main").getByLabel("Search").fill("Precious");
  await expect(page.getByRole("table", { name: "Audit log" }).getByText("Declined a sign-up")).toBeVisible();
});

test("add, find, suspend and restore a member; import a CSV with mistakes", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/members");
  await page.getByRole("button", { name: "Add member" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a member" });
  await sheet.getByLabel(/Full name/).fill("Kunle Adewale");
  await sheet.getByLabel(/Email/).fill("kunle.adewale@example.com");
  await sheet.getByLabel("Team").selectOption({ label: "Kitchen" });
  await sheet.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText("Kunle Adewale added")).toBeVisible();

  await page.getByRole("main").getByLabel("Search").fill("adewale kunle");
  const table = page.getByRole("table", { name: "Members directory" });
  await expect(table.getByRole("link", { name: "Kunle Adewale" })).toBeVisible();
  await expect(page.getByText(/Showing 1 of/)).toBeVisible();

  await table.getByRole("button", { name: "Actions for Kunle Adewale" }).click();
  await page.getByRole("menuitem", { name: "Suspend" }).click();
  const suspend = page.getByRole("dialog", { name: "Suspend Kunle Adewale" });
  await suspend.getByLabel(/Reason/).fill("Testing the suspend flow");
  await suspend.getByRole("button", { name: "Suspend" }).click();
  await expect(page.getByText("Kunle Adewale suspended")).toBeVisible();
  await expect(table.getByText("Suspended")).toBeVisible();

  await table.getByRole("button", { name: "Actions for Kunle Adewale" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  const remove = page.getByRole("dialog", { name: "Remove Kunle Adewale" });
  await remove.getByLabel(/Reason/).fill("Added by mistake in a test");
  await remove.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("You can restore them within 30 days.")).toBeVisible();
  await page.getByLabel("Status").selectOption("REMOVED");
  await table.getByRole("button", { name: "Actions for Kunle Adewale" }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Kunle Adewale restored")).toBeVisible();

  await page.getByRole("button", { name: "Import CSV" }).click();
  const imp = page.getByRole("dialog", { name: "Import members from CSV" });
  await imp.locator("#import-file").setInputFiles(path.join(process.cwd(), "public/files/member-import-sample.csv"));
  await expect(imp.getByRole("list", { name: "Rows ready to import" }).getByRole("listitem")).toHaveCount(3);
  const errors = imp.getByRole("list", { name: "Import errors" });
  await expect(errors.getByText(/is not an email address/)).toBeVisible();
  await expect(errors.getByText(/already has an account/)).toBeVisible();
  await expect(errors.getByText(/There is no team called "Choir"/)).toBeVisible();
  await imp.getByRole("button", { name: "Import 3 people" }).click();
  await expect(page.getByText("3 people imported")).toBeVisible();
});

test("roles show what changes; admin levels need a Super Admin", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/roles");
  await page.getByRole("main").getByLabel("Search").fill("Adebayo");
  await page.getByRole("button", { name: "Change role for Adebayo Johnson" }).click();
  const dialog = page.getByRole("dialog", { name: "Change role for Adebayo Johnson" });
  await dialog.getByLabel("Volunteer").check();
  await dialog.getByLabel("Check-in Marshal").click();
  const effects = dialog.getByRole("region", { name: "What changes" });
  await expect(effects.getByText("Member becomes Volunteer.")).toBeVisible();
  await expect(effects.getByText("Marshal tools (live lists, manual check-in)")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByText("Adebayo Johnson's role is updated")).toBeVisible();
  await expect(page.getByRole("table", { name: "People and their roles" }).getByText("Check-in Marshal")).toBeVisible();

  // A Unit Admin cannot change an admin, nor open Settings.
  const unit = await asAdmin(browser, UNIT);
  await unit.goto("/admin/roles");
  await unit.getByRole("main").getByLabel("Search").fill("Daniel");
  await expect(unit.getByRole("button", { name: "Change role for Pastor Daniel Ojo" })).toBeDisabled();
  await expect(unit.getByRole("button", { name: "Invite an admin" })).toHaveCount(0);
  await unit.goto("/admin/settings");
  await expect(unit).toHaveURL(/\/forbidden/);
  const api = await unit.request.patch("/api/v1/admin/settings", { data: {} });
  expect(api.status()).toBe(403);
});

test("settings save the geofence and the audit log shows before and after", async ({ browser }) => {
  const page = await asAdmin(browser);
  await page.goto("/admin/settings");
  const radius = page.getByLabel(/Geofence radius/);
  await radius.focus();
  for (let i = 0; i < 5; i++) await radius.press("ArrowRight");
  await expect(page.getByText("Geofence radius: 150 m")).toBeVisible();
  await page.getByLabel("Accuracy threshold").fill("60");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await expect(page.getByText("All changes saved.")).toBeVisible();

  await page.getByLabel("Gold from").fill("70");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Gold must be above Green, and Green above Amber.")).toBeVisible();

  await page.goto("/admin/audit");
  await page.getByLabel("What").selectOption({ label: "Changed settings" });
  const latest = page.getByRole("table", { name: "Audit log" }).getByRole("row").nth(1);
  await latest.getByText("Before and after").click();
  await expect(latest.getByText("venue.radiusM:")).toBeVisible();
  await expect(latest.locator("dd", { hasText: "150" })).toBeVisible();
  const csv = await page.request.get("/api/v1/admin/audit?format=csv&action=SETTINGS_UPDATED");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("venue.radiusM: 100 -> 150");
});

test("every admin core screen is accessible and fits a phone", async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await asAdmin(browser);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const p of [
    "/admin",
    "/admin/members",
    "/admin/members/usr-chioma",
    "/admin/approvals",
    "/admin/roles",
    "/admin/audit",
    "/admin/settings",
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin");
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({ path: "test-results/screens/admin-dashboard-1280.png", fullPage: true });
});
