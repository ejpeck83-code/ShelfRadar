import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("classification -> ranked factors -> product detail -> Own suppression", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "New discoveries" })).toBeVisible();

  const first = page.getByRole("article").first();
  await expect(first.getByText("Match review")).toBeVisible();
  await first.getByRole("button", { name: "Hunt" }).click();
  await expect(first.getByRole("button", { name: "Hunt" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Hunts" }).click();
  await expect(page.getByRole("heading", { name: "Hunts" })).toBeVisible();
  await expect(page.getByText("Strong lead").first()).toBeVisible();
  await expect(page.getByText("Exact named-store sighting within 24 hours")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("%");

  await page.getByRole("link", { name: "View product evidence" }).click();
  await expect(page.getByRole("heading", { name: /Ultimate Leonardo/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Identifiers" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy UPC/ })).toBeVisible();
  await expect(page.getByText("Retailer signals are not proof of shelf inventory.")).toBeVisible();
  await expect(page.getByText("Named local Ross")).toBeVisible();
  await expect(page.getByText("Review needed")).toBeVisible();

  await page.getByRole("button", { name: "Own" }).click();
  await expect(page.getByRole("button", { name: "Own" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Hunts" }).click();
  await expect(page.getByRole("heading", { name: "No active hunts" })).toBeVisible();
});

test("Ross local filter keeps national activity out of local results", async ({ page }) => {
  await page.goto("/signals");
  await page.getByLabel("Retailer").selectOption("Ross");
  await page.getByLabel("Scope").selectOption("local");
  await expect(page.getByText("Named local Ross")).toBeVisible();
  await expect(page.getByText("National Ross activity")).toHaveCount(0);
  await expect(page.getByText("not a retailer inventory claim")).toBeVisible();
});

test("degraded source keeps cached evidence and timestamps visible", async ({ page }) => {
  await page.goto("/signals");
  await expect(page.getByText("Reddit is currently unavailable")).toBeVisible();
  await page.getByLabel("Signal type").selectOption("source-health");
  await expect(page.getByText("Cached crowd evidence remains visible")).toBeVisible();
  await expect(page.getByText("Source unavailable · cached evidence")).toBeVisible();
  await expect(page.getByText("9 hours ago")).toBeVisible();
});

test("core pages have no serious accessibility violations", async ({ page }) => {
  for (const route of ["/discover", "/hunts", "/signals", "/products/2d1f0d9e-06d4-4e61-b7f1-6d10442fda01"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  }
});

test("primary controls expose visible keyboard focus", async ({ page }) => {
  await page.goto("/discover");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  await expect(focused).toHaveCSS("outline-style", "solid");
});
