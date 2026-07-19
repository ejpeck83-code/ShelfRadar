import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(!process.env.PRODUCTION_SMOKE, "PRODUCTION_SMOKE is required for live production checks");

test("production challenges unauthenticated requests", async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/discover`, { redirect: "manual" });
  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toContain("Basic");
});

test("persistent production discovers real products and persists classification", async ({ page }, testInfo) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "New discoveries" })).toBeVisible();
  await expect(page.getByText("Persisted catalog")).toBeVisible();
  const product = page.getByRole("article").nth(testInfo.project.name === "mobile-chromium" ? 1 : 0);
  await expect(product.locator(".source-chips").getByText(/NECA.*live/)).toBeVisible();
  const huntSaved = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/products\/[^/]+\/state$/.test(new URL(response.url()).pathname));
  await product.getByRole("button", { name: "Hunt" }).click();
  expect((await huntSaved).status()).toBe(200);
  await expect(product.getByRole("button", { name: "Hunt" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(product.getByRole("button", { name: "Hunt" })).toHaveAttribute("aria-pressed", "true");
  const newSaved = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/products\/[^/]+\/state$/.test(new URL(response.url()).pathname));
  await product.getByRole("button", { name: "New" }).click();
  expect((await newSaved).status()).toBe(200);
  await expect(product.getByRole("button", { name: "New" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(product.getByRole("button", { name: "New" })).toHaveAttribute("aria-pressed", "true");
  await product.getByRole("link", { name: /^Open / }).click();
  await expect(page.getByRole("heading", { name: "Retailer listings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open at NECA Store/ })).toHaveAttribute("href", /^https:\/\/store\.necaonline\.com\/products\//);
  await expect(page.getByText(/online only|preorder|out of stock/i).first()).toBeVisible();
});

test("production shows real public signals and truthful source health", async ({ page }) => {
  await page.goto("/signals");
  await expect(page.getByRole("heading", { name: "Signals" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open public post/ }).first()).toHaveAttribute("href", /^https:\/\/www\.reddit\.com\/r\//);
  await expect(page.getByText("Fixture demo.")).toHaveCount(0);

  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Source status" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "NECA" }).getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Reddit / Ross Finds" }).getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(4);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});
