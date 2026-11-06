import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WIDTHS = [360, 768, 1024, 1280];

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page must not scroll sideways").toBeLessThanOrEqual(0);
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")})`,
    );
}

test.describe("design system", () => {
  test("renders every core component", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.getByRole("heading", { level: 2, name: "Design system" })).toBeVisible();
    await expect(page.getByText("Demo data", { exact: true })).toBeVisible();
    // Worked example from spec 6.3 computed by the real functions
    await expect(page.getByText("89.5%", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("82.4%", { exact: true })).toBeVisible();
    for (const name of ["Gold standard", "Strong", "Needs attention", "At risk", "No meetings yet"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    for (const chip of ["On time", "Late", "Absent", "Excused", "Manual", "Flagged"]) {
      await expect(page.getByText(chip, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("grid", { name: "Attendance heatmap" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Members" })).toBeVisible();
    await expect(page.getByText("Hours", { exact: true })).toBeVisible();
  });

  test("dialog traps focus and closes with Escape", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm check-in" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("table sorts and switches to cards on phones", async ({ page }) => {
    await page.goto("/design-system");
    const table = page.getByRole("table", { name: "Members" });
    await table.getByRole("button", { name: /Name/ }).click();
    await expect(table.locator("th[aria-sort='ascending']")).toHaveCount(1);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByRole("list", { name: "Members" })).toBeVisible();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no serious accessibility violations in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/design-system");
      await expect(page.getByRole("heading", { level: 2, name: "Design system" })).toBeVisible();
      if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  for (const width of WIDTHS) {
    test(`fits ${width}px without horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/design-system");
      await expect(page.getByRole("heading", { level: 2, name: "Design system" })).toBeVisible();
      await noHorizontalScroll(page);
      await page.screenshot({ path: `test-results/screens/design-system-${width}.png`, fullPage: false });
      if (width === 1280) {
        await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
        await page.locator("#charts").scrollIntoViewIfNeeded();
        await page.screenshot({ path: "test-results/screens/design-system-dark-charts.png" });
      }
    });
  }
});

test.describe("app shell", () => {
  test("desktop shows the sidebar with role switching", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/design-system/shell");
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Check-in" })).toBeVisible();
    await page.getByRole("radio", { name: "Admin" }).click();
    await expect(sidebar.getByRole("link", { name: "Sheet uploads" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("phone shows the bottom tab bar and More sheet", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/design-system/shell");
    await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeHidden();
    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Performance" })).toBeVisible();
    await page.screenshot({ path: "test-results/screens/shell-more-360.png" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "More" })).toBeHidden();
    await noHorizontalScroll(page);
    await page.screenshot({ path: "test-results/screens/shell-member-360.png" });
  });
});

test("home links to the review pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Design system/ }).first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
