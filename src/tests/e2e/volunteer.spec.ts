import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email: string) {
  await page.goto("/login?tab=volunteer");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Demo@2026");
  await page.getByRole("button", { name: "Sign in as volunteer" }).click();
  await expect(page).toHaveURL(/\/volunteer$/);
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

test.beforeAll(async ({ request }) => {
  await request.post("/api/v1/demo/reset");
});

test("a volunteer signs up for a duty and withdraws", async ({ page }) => {
  await signIn(page, "volunteer2@hod-demo.example.com");
  await page.goto("/volunteer/duties");
  const tabs = page.getByRole("tablist", { name: "Saturday" }).getByRole("tab");
  await tabs.last().click();
  await expect(page.getByText(/You have no duty for/)).toBeVisible();
  await page.getByRole("button", { name: "Sign up for Kitchen" }).click();
  await expect(page.getByText("You are on Kitchen")).toBeVisible();
  await expect(page.getByText(/You are on Kitchen for/)).toBeVisible();
  // Other zones are locked while I hold a duty.
  await expect(page.getByRole("button", { name: "Sign up for Outdoors" })).toBeDisabled();
  await page.getByRole("button", { name: "Withdraw" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByText("You withdrew from Kitchen")).toBeVisible();
});

test("a marshal records a manual check-in, shown as Manual and flagged", async ({ page }) => {
  await signIn(page, "volunteer@hod-demo.example.com");
  // Use the demo clock to be inside Saturday's check-in window.
  await page.goto("/member/check-in");
  await page.getByRole("group", { name: "Simulate time" }).getByRole("button", { name: "Sat 09:31" }).click();
  await page.goto("/volunteer/marshal");
  await expect(page.getByText(/Check-in is open: arrivals count as Late/)).toBeVisible();
  await page.getByRole("button", { name: "Manual check-in" }).click();
  const dialog = page.getByRole("dialog", { name: "Manual check-in" });
  const select = dialog.getByLabel(/Person/);
  const first = await select.locator("option").nth(1).textContent();
  await select.selectOption({ index: 1 });
  await dialog.getByLabel(/Reason/).fill("Phone battery flat");
  await dialog.getByRole("button", { name: "Record check-in" }).click();
  await expect(page.getByText(`${first} checked in: Late`)).toBeVisible();
  const late = page.getByRole("list", { name: "Late list" });
  await expect(late.getByText(first!)).toBeVisible();
  await expect(late.getByText("Manual").first()).toBeVisible();
  await expect(late.getByText("Flagged").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code for check-in code [A-Z2-9]{6}/ })).toBeVisible();
});

test("hours, certificate, issue report, encouragement and RSVP", async ({ page }) => {
  await signIn(page, "volunteer@hod-demo.example.com");
  await expect(page.getByText("Your next duty", { exact: true })).toBeVisible();

  await page.goto("/volunteer/hours");
  await page.getByRole("button", { name: "Log hours" }).click();
  const sheet = page.getByRole("dialog", { name: "Log service hours" });
  await sheet.getByLabel(/What did you do/).fill("Restocked the kitchen supplies");
  await sheet.getByRole("button", { name: "Log hours" }).click();
  await expect(page.getByText("Hours logged")).toBeVisible();
  await expect(page.getByText("Restocked the kitchen supplies")).toBeVisible();
  const cert = await page.request.get(`/api/v1/hours/certificate.pdf`);
  expect(cert.headers()["content-type"]).toBe("application/pdf");
  expect((await cert.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await page.goto("/volunteer/issues");
  await page.getByLabel(/What is wrong/).fill("The mop bucket in the kitchen store is cracked and leaks.");
  await page.getByRole("group", { name: "Urgency" }).getByText("Urgent", { exact: true }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Issue reported")).toBeVisible();
  await expect(page.getByText("The mop bucket in the kitchen store is cracked and leaks.")).toBeVisible();

  await page.goto("/volunteer/team");
  const btn = page.getByRole("button", { name: /^Send encouragement to/ }).first();
  await btn.click();
  await expect(page.getByText(/Encouragement sent to/)).toBeVisible();

  await page.goto("/volunteer/events");
  await page
    .getByRole("group", { name: /^RSVP for/ })
    .first()
    .getByRole("button", { name: "Going" })
    .click();
  await expect(page.getByText("RSVP saved: Going")).toBeVisible();
});

test("every volunteer screen is accessible and fits a phone", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "volunteer@hod-demo.example.com");
  for (const path of [
    "/volunteer",
    "/volunteer/events",
    "/volunteer/attendance",
    "/volunteer/duties",
    "/volunteer/hours",
    "/volunteer/issues",
    "/volunteer/marshal",
    "/volunteer/team",
    "/volunteer/messages",
    "/volunteer/settings",
  ]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await serious(page), path).toEqual([]);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
        message: `${path} at 360px`,
      })
      .toBeLessThanOrEqual(0);
  }
  await page.goto("/volunteer");
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({ path: "test-results/screens/volunteer-home-360.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/volunteer");
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({ path: "test-results/screens/volunteer-home-1280.png", fullPage: true });
});
