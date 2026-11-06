import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

test.describe.configure({ mode: "serial" });

const PASSWORD = "Demo@2026";

async function signIn(page: Page, email: string, tab: "member" | "volunteer" = "member") {
  await page.goto(`/login?tab=${tab}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: `Sign in as ${tab}` }).click();
  await expect(page).toHaveURL(new RegExp(`/${tab}$`));
}

/** Use the demo panel on the check-in page to jump to a time, pick a location, locate and (optionally) confirm. */
async function checkIn(page: Page, time: string, location: RegExp, confirm = true) {
  await page.goto("/member/check-in");
  await page.getByRole("group", { name: "Simulate time" }).getByRole("button", { name: time }).click();
  await expect(page.getByRole("button", { name: "Find my location" })).toBeVisible();
  await page.getByRole("radio", { name: location }).check();
  await page.getByRole("button", { name: "Find my location" }).click();
  if (confirm) {
    await page.getByRole("button", { name: "Confirm check-in" }).click();
    await expect(page.getByRole("heading", { name: "You are checked in" })).toBeVisible();
  }
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

test("Saturday check-in at 09:20 inside the radius is On time, and the percentage updates", async ({ page }) => {
  await signIn(page, "member@hod-demo.example.com");
  await checkIn(page, "Sat 09:20", /^At the venue\s*25 m/);
  await expect(page.getByText("On time · 9:20 am")).toBeVisible();
  await expect(page.getByText("25 m from the venue pin.")).toBeVisible();
  await expect(page.getByRole("figure", { name: /Your attendance: 88\.2 percent/ })).toBeVisible();
  // Home now shows the check-in.
  await page.goto("/member");
  await expect(page.getByText(/Checked in · On time 9:20 am/)).toBeVisible();
});

test("Saturday check-in at 09:31 is Late, and the home page warned about it", async ({ page }) => {
  await signIn(page, "gold@hod-demo.example.com");
  await page.goto("/member/check-in");
  await page.getByRole("group", { name: "Simulate time" }).getByRole("button", { name: "Sat 09:31" }).click();
  await page.goto("/member");
  await expect(page.getByRole("alert").filter({ hasText: "The meeting has started." })).toBeVisible();
  await checkIn(page, "Sat 09:31", /^At the venue\s*25 m/);
  await expect(page.getByText("Late · 9:31 am")).toBeVisible();
});

test("2 km away is refused with the distance; poor accuracy asks to retry; before 08:30 it is not open", async ({
  page,
}) => {
  await signIn(page, "almost@hod-demo.example.com");
  await checkIn(page, "Sat 09:20", /^2 km away/, false);
  await expect(page.getByText(/You are 2,0\d\d m from the venue, outside the 100 m check-in area/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Get directions/ })).toBeVisible();
  await page.getByRole("radio", { name: /^Poor accuracy/ }).check();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Move outdoors and retry" })).toBeVisible();
  await page.getByRole("group", { name: "Simulate time" }).getByRole("button", { name: "Sat 08:25" }).click();
  await expect(page.getByText("Check-in is not open yet")).toBeVisible();
});

test("downloads: PDF statement, calendar file and CSV export", async ({ page }) => {
  await signIn(page, "member@hod-demo.example.com");
  const pdf = await page.request.get("/api/v1/me/report.pdf?period=all");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(3000);

  await page.goto("/member/report");
  await expect(page.getByRole("heading", { name: "Adebayo Johnson" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^attendance-adebayo-johnson-.*\.pdf$/);

  await page.goto("/member/schedule");
  const first = page.getByRole("button", { name: /^Add to calendar/ }).first();
  await first.click();
  const [ics] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Download \.ics/ }).click(),
  ]);
  expect(readFileSync((await ics.path())!, "utf8")).toContain("BEGIN:VCALENDAR");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Month" }).click();
  await expect(page.getByRole("table", { name: /Meetings in/ })).toBeVisible();

  await page.goto("/member/attendance");
  await expect(page.getByRole("grid", { name: "My attendance heatmap" })).toBeVisible();
  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export CSV" }).click(),
  ]);
  const text = readFileSync((await csv.path())!, "utf8");
  expect(text).toContain("Date,Meeting,Status,Check-in time (Lagos),Recorded by");
  expect(text.split("\r\n").length).toBeGreaterThan(40);
});

test("excuse request, notifications and messages", async ({ page }) => {
  await signIn(page, "volunteer2@hod-demo.example.com", "volunteer");
  await page.goto("/member/excuses");
  await page.getByRole("button", { name: "New request" }).click();
  const dialog = page.getByRole("dialog", { name: "New excuse request" });
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByText("Tell us a little more")).toBeVisible();
  await dialog.getByLabel(/Reason/).fill("Travelling to Abuja for my sister's wedding that weekend.");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Excuse request sent")).toBeVisible();
  await expect(page.getByText("Travelling to Abuja for my sister's wedding that weekend.")).toBeVisible();
  await expect(page.getByText("Pending review").first()).toBeVisible();

  await page.goto("/member/notifications");
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText(/Marked \d+ as read/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all read" })).toBeDisabled();

  await page.goto("/member/messages");
  await page.getByRole("button", { name: /Duty roster for November is out/ }).click();
  await expect(page.getByRole("heading", { name: "Duty roster for November is out" })).toBeVisible();
});

test("settings save, and remote members are not asked to check in on Saturday", async ({ page }) => {
  await signIn(page, "remote@hod-demo.example.com");
  await page.goto("/member/settings");
  await page.getByLabel("City").fill("Manchester");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await page.getByRole("switch", { name: /Weekly summary/ }).click();
  await expect(page.getByText("Reminder settings saved")).toBeVisible();
  // Remote members skip the Saturday geofence: the check-in page offers the next in-person event instead, never a Saturday.
  await page.goto("/member/check-in");
  await expect(page.getByRole("heading", { level: 1, name: "Check in" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Saturday Sanitation Meeting" })).toHaveCount(0);
  const res = await page.request.post("/api/v1/meetings/mtg-2026-11-14-sat/check-in", {
    data: { latitude: 6.60202, longitude: 3.35152, accuracy: 10, deviceId: "remote-device-0001" },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe("REMOTE_MEMBER");
});

test("every member screen is accessible and fits a phone", async ({ page }) => {
  test.setTimeout(120_000);
  // Reduced motion turns off the page fade-in, so contrast is measured on settled text.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "member@hod-demo.example.com");
  for (const path of [
    "/member",
    "/member/check-in",
    "/member/attendance",
    "/member/performance",
    "/member/schedule",
    "/member/notifications",
    "/member/excuses",
    "/member/messages",
    "/member/report",
    "/member/help",
    "/member/settings",
  ]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await serious(page), path).toEqual([]);
    await page.setViewportSize({ width: 360, height: 800 });
    // Charts resize on the next frame after the viewport changes, so poll until the layout settles.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
        message: `${path} at 360px`,
      })
      .toBeLessThanOrEqual(0);
  }
  await page.goto("/member");
  await page.screenshot({ path: "test-results/screens/member-home-360.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/member");
  await page.screenshot({ path: "test-results/screens/member-home-1280.png", fullPage: true });
});
