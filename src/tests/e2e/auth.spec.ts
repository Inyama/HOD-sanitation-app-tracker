import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DateTime } from "luxon";

// These flows share the server's in-memory state (outbox, invites), so run them in order.
test.describe.configure({ mode: "serial" });

const PASSWORD = "Demo@2026";

async function signIn(
  page: Page,
  email: string,
  tab: "member" | "volunteer" | "admin" = "member",
  password = PASSWORD,
) {
  await page.goto(`/login?tab=${tab}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: `Sign in as ${tab}` }).click();
}

async function signInAdmin(page: Page, email: string) {
  await signIn(page, email, "admin");
  await page.getByLabel("Six-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
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

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function emailLink(request: APIRequestContext, to: string, kind: string) {
  const res = await request.get("/api/v1/demo/outbox");
  const items = (await res.json()).items as { to: string; kind: string; text: string }[];
  const email = items.find((e) => e.to === to && e.kind === kind);
  expect(email, `${kind} email to ${to}`).toBeTruthy();
  return (
    new URL(email!.text.match(/https?:\/\/\S+/)![0]).pathname + new URL(email!.text.match(/https?:\/\/\S+/)![0]).search
  );
}

test.beforeAll(async ({ request }) => {
  await request.post("/api/v1/demo/reset");
});

test("landing page shows the hero, live countdown, schedule, venue and sign-in links", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Serving God with excellence, one clean space at a time" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Saturday Sanitation Meeting|Thursday Prayer Meeting/ }).first(),
  ).toBeVisible();
  await expect(page.getByText("Seconds", { exact: true })).toBeVisible();
  await expect(page.getByText("Every Saturday at 9:30 am")).toBeVisible();
  await expect(page.getByText("Every Thursday at 8:30 pm")).toBeVisible();
  await expect(page.getByRole("region", { name: /Map showing/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Get directions/ })).toHaveAttribute(
    "href",
    /google\.com\/maps\/dir\/.*destination=6\.6018,3\.3515/,
  );
  for (const role of ["Member", "Volunteer", "Admin"])
    await expect(page.getByRole("link", { name: new RegExp(`${role} sign in`) })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy and location notice" })).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await page.setViewportSize({ width: 360, height: 800 });
  await noSideScroll(page);
  await page.screenshot({ path: "test-results/screens/landing-360.png" });
});

test("the landing countdown agrees with the meeting date and time it shows", async ({ page }) => {
  // 90 minutes before the next real Saturday meeting (9:30 am Lagos).
  let sat = DateTime.now().setZone("Africa/Lagos").set({ hour: 9, minute: 30, second: 0, millisecond: 0 });
  while (sat.weekday !== 6 || sat <= DateTime.now()) sat = sat.plus({ days: 1 }).set({ hour: 9, minute: 30 });
  await page.clock.setFixedTime(sat.minus({ minutes: 90 }).toJSDate());
  await page.goto("/");
  const card = page.locator("section[aria-labelledby='hero-title']");
  await expect(card.getByRole("heading", { name: "Saturday Sanitation Meeting" })).toBeVisible();
  await expect(card.getByText(`${sat.toFormat("ccc d LLL")}, 9:30 am (Lagos)`)).toBeVisible();
  await expect(card.getByText("Starts in 1 hour and 30 minutes.")).toBeAttached();
});

test("member signs in, sees their own numbers, and signs out", async ({ page }) => {
  await signIn(page, "member@hod-demo.example.com");
  await expect(page).toHaveURL(/\/member$/);
  await expect(page.getByRole("heading", { name: "Welcome, Adebayo" })).toBeVisible();
  await expect(page.getByRole("figure", { name: /Overall: 88 percent, Strong/ })).toBeVisible();
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/member");
  await expect(page).toHaveURL(/\/login\?next=%2Fmember/);
});

test("role guards block cross-area access", async ({ page }) => {
  await signIn(page, "member@hod-demo.example.com");
  await expect(page).toHaveURL(/\/member$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/forbidden\?path=%2Fadmin/);
  await expect(page.getByRole("heading", { name: "You do not have access to this page" })).toBeVisible();
  await page.goto("/volunteer/duties");
  await expect(page).toHaveURL(/\/forbidden/);
});

test("signed-out visitors go to the right sign-in tab and come back afterwards", async ({ page }) => {
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fmembers&tab=admin/);
  await expect(page.getByRole("tab", { name: "Admin" })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Email").fill("attendance@hod-demo.example.com");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in as admin" }).click();
  await page.getByLabel("Six-digit code").fill("000111");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/members$/);
  await expect(page.getByRole("heading", { name: "Members directory" })).toBeVisible();
});

test("volunteer titles and admin levels decide what opens", async ({ browser }) => {
  const grace = await (await browser.newContext()).newPage();
  await signIn(grace, "volunteer@hod-demo.example.com", "volunteer");
  await expect(grace).toHaveURL(/\/volunteer$/);
  await expect(grace.getByRole("main").getByText(/Serving as Team Lead and Check-in Marshal/)).toBeVisible();
  await grace.goto("/volunteer/marshal");
  await expect(grace.getByRole("heading", { name: "Marshal tools" })).toBeVisible();
  await grace.close();

  const michael = await (await browser.newContext()).newPage();
  await signIn(michael, "volunteer2@hod-demo.example.com", "volunteer");
  await expect(michael).toHaveURL(/\/volunteer$/);
  await expect(michael.getByRole("link", { name: "Marshal tools" })).toHaveCount(0);
  await michael.goto("/volunteer/marshal");
  await expect(michael).toHaveURL(/\/forbidden/);
  await michael.close();

  const joshua = await (await browser.newContext()).newPage();
  await signInAdmin(joshua, "comms@hod-demo.example.com");
  await joshua.goto("/admin/messages");
  await expect(joshua.getByRole("heading", { name: "Messaging center" })).toBeVisible();
  await joshua.goto("/admin/settings");
  await expect(joshua).toHaveURL(/\/forbidden/);
  await joshua.close();

  const naomi = await (await browser.newContext()).newPage();
  await signInAdmin(naomi, "auditor@hod-demo.example.com");
  await naomi.goto("/admin/audit");
  await expect(naomi.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await naomi.goto("/admin/approvals");
  await expect(naomi).toHaveURL(/\/forbidden/);
  await naomi.close();

  const daniel = await (await browser.newContext()).newPage();
  await signInAdmin(daniel, "admin@hod-demo.example.com");
  await daniel.goto("/admin/settings");
  await expect(daniel.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(await serious(daniel)).toEqual([]);
  await daniel.close();
});

test("sign-in errors are specific but safe", async ({ page }) => {
  await signIn(page, "member@hod-demo.example.com", "member", "not-the-password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("That email and password do not match");
  await signIn(page, "pending@hod-demo.example.com");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("waiting for approval");
  await signIn(page, "suspended@hod-demo.example.com");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("suspended");
  await signIn(page, "member@hod-demo.example.com", "admin");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("not an admin account");
});

test("five failed attempts lock sign-in for 15 minutes", async ({ page }) => {
  const email = `lock-${Date.now()}@example.com`;
  for (let i = 0; i < 5; i++) await signIn(page, email, "member", "wrong-password");
  await signIn(page, email, "member", "wrong-password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("paused for 15 minutes");
});

test("sign up, confirm the email, then wait on the Pending screen; then reset the password", async ({
  page,
  request,
}) => {
  const email = `amaka.${Date.now()}@example.com`;
  await page.goto("/signup/member");
  await page.getByRole("button", { name: "Create my member account" }).click();
  await expect(page.getByText("Some fields need attention")).toBeVisible();
  await expect(page.getByLabel(/Full name/)).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel(/Full name/).fill("Amaka Nwosu");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Phone/).fill("+234 803 000 1111");
  await page.getByLabel(/^City/).fill("Ikeja");
  await page.getByLabel(/Create a password/).fill("Serve-With-Excellence-2026");
  await expect(page.getByText(/Strength: Strong/)).toBeVisible();
  await page.getByLabel(/my location is read only/).check();
  await page.getByLabel(/receive meeting reminders/).check();
  expect(await serious(page)).toEqual([]);
  await page.getByRole("button", { name: "Create my member account" }).click();
  await expect(page).toHaveURL(/\/verify-email\?sent=1/);
  await expect(page.getByText(email)).toBeVisible();

  await page.goto(await emailLink(request, email, "VERIFY_EMAIL"));
  await expect(page.getByText("your email is confirmed")).toBeVisible();
  await page.getByRole("link", { name: "See what happens next" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for joining" })).toBeVisible();

  await signIn(page, email, "member", "Serve-With-Excellence-2026");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("waiting for approval");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If an account exists/)).toBeVisible();
  await page.goto(await emailLink(request, email, "PASSWORD_RESET"));
  await page.getByLabel("New password").fill("A-Brand-New-Password-9");
  await page.getByLabel("Type it again").fill("A-Brand-New-Password-9");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/login\?reason=reset/);
  await expect(page.getByText("Your password has been changed")).toBeVisible();
  await signIn(page, email, "member", "A-Brand-New-Password-9");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("waiting for approval");
});

test("admin invitation: set a password, turn on two-factor and land in the admin area", async ({ page }) => {
  await page.goto("/accept-invite/demo-invite-2026");
  await expect(page.getByText("new.comms@example.com")).toBeVisible();
  await page.getByLabel(/Full name/).fill("Bisi Adewale");
  await page.getByLabel("Create a password").fill("Serve-With-Excellence-2026");
  await page.getByLabel("Type it again").fill("Serve-With-Excellence-2026");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  await page.getByLabel(/Six-digit code/).fill("246810");
  await page.getByRole("button", { name: "Turn on two-factor and finish" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(/Signed in as Communications Officer/)).toBeVisible();

  await page.goto("/accept-invite/demo-invite-expired");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("expired");
});

test("public pages are accessible and fit a phone", async ({ page }) => {
  for (const path of ["/login", "/signup/volunteer", "/privacy", "/pending", "/forgot-password"]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(await serious(page), path).toEqual([]);
    await page.setViewportSize({ width: 360, height: 800 });
    await noSideScroll(page);
  }
  await page.goto("/login");
  await page.screenshot({ path: "test-results/screens/login-360.png" });
});
