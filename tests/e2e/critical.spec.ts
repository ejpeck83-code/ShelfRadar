import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("discover -> classify Hunt -> Hunts -> detail -> Own", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "New discoveries" })).toBeVisible();
  const first = page.getByRole("article").first();
  await first.getByRole("button", { name: "Hunt" }).click();
  await expect(first.getByRole("button", { name: "Hunt" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Hunts" }).click();
  await expect(page.getByText("Target Fishers · Possible lead")).toBeVisible();
  await page.getByRole("link", { name: /Open NECA TMNT/ }).click();
  await expect(page.getByRole("heading", { name: /Ultimate Leonardo/ })).toBeVisible();
  await expect(page.getByText("Retailer signals are not proof of shelf inventory.")).toBeVisible();
  await page.getByRole("button", { name: "Own" }).click();
  await expect(page.getByRole("button", { name: "Own" })).toHaveAttribute("aria-pressed", "true");
});

test("core pages have no serious accessibility violations", async ({ page }) => {
  for (const route of ["/discover", "/status"]) {
    await page.goto(route); const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  }
});
