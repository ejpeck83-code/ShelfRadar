import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("discover -> classify Hunt -> Hunts -> detail -> Own", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "New discoveries" })).toBeVisible();
  const first = page.getByRole("article").first();
  await first.getByRole("button", { name: "Hunt" }).click();
  await expect(first.getByRole("button", { name: "Hunt" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Hunts" }).click();
  await expect(page.getByRole("heading", { name: "Field board" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Target Fishers", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Checked none" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Search Target/ }).first()).toBeVisible();
  await expect(page.getByText("Ross Fishers report · Strong lead")).toBeVisible();
  await page.getByRole("link", { name: /Open NECA TMNT/ }).click();
  await expect(page.getByRole("heading", { name: /Ultimate Leonardo/ })).toBeVisible();
  await expect(page.getByText("Retailer signals are not proof of shelf inventory.")).toBeVisible();
  await page.getByRole("button", { name: "Own" }).click();
  await expect(page.getByRole("button", { name: "Own" })).toHaveAttribute("aria-pressed", "true");
});

test("filters Ross signals without collapsing location scopes", async ({ page }) => {
  await page.goto("/signals");
  await page.getByLabel("Retailer").selectOption("ross");
  await page.getByLabel("Location").selectOption("LOCAL");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/retailer=ross/);
  await expect(page.getByText(/Named-store report/).first()).toBeVisible();
  await expect(page.locator(".signal-card .scope-regional")).toHaveCount(0);
  await expect(page.getByText("Fixture demo.")).toBeVisible();
});

test("detail exposes cross-retailer listings and degraded source truth", async ({ page }) => {
  await page.goto("/products/2d1f0d9e-06d4-4e61-b7f1-6d10442fda01");
  await expect(page.getByRole("heading", { name: "Retailer listings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Walmart/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Search Walmart/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Field check shortcuts" })).toBeVisible();
  await expect(page.getByText("Source unavailable")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Related public sightings" })).toBeVisible();
  await expect(page.getByText("Product match needs review").first()).toBeVisible();
});

test("classification network failure stays recoverable", async ({ page }) => {
  await page.route("**/api/products/*/state", (route) => route.abort());
  await page.goto("/discover");
  await page.getByRole("article").first().getByRole("button", { name: "Watch" }).click();
  await expect(page.getByText("Could not save classification.")).toBeVisible();
  await expect(page.getByRole("article").first().getByRole("button", { name: "Watch" })).toBeEnabled();
});

test("primary discovery actions are keyboard reachable", async ({ page }) => {
  await page.goto("/discover");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Shelf Radar" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("article").first().getByRole("link", { name: /Open NECA TMNT/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("article").first().getByRole("button", { name: "New" })).toBeFocused();
});

test("content reflows at 320px without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const route of ["/discover", "/hunts", "/signals", "/status", "/products/2d1f0d9e-06d4-4e61-b7f1-6d10442fda01"]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("core pages have no serious accessibility violations", async ({ page }) => {
  for (const route of ["/discover", "/hunts", "/signals", "/status", "/products/2d1f0d9e-06d4-4e61-b7f1-6d10442fda01"]) {
    await page.goto(route); const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  }
});
