import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure"
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  ...(process.env.PREVIEW_BASE_URL ? {} : { webServer: {
    command: "npm run demo:web -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/discover",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  } })
});
