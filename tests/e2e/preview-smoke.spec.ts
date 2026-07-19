import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(!process.env.PREVIEW_BASE_URL, "PREVIEW_BASE_URL is required for deployed preview smoke tests");

for (const route of ["/discover", "/hunts", "/signals", "/status", "/products/2d1f0d9e-06d4-4e61-b7f1-6d10442fda01"]) {
  test(`fixture preview renders ${route} without serious accessibility issues`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveTitle(/Shelf Radar/);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText(/fixture/i).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
