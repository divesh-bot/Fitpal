import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser end-to-end tests against the REAL backend and Supabase.
 * Requires SUPABASE_SECRET_KEY in the environment (used only by global
 * setup/teardown to create and delete a temporary test user; never logged).
 *
 *   SUPABASE_SECRET_KEY=... npm run test:e2e
 */
process.loadEnvFile?.(".env.local");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "npm run build && node --env-file=.env dist/server.js",
      cwd: "../backend",
      url: "http://localhost:4000/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npx next dev -p 3000",
      url: "http://localhost:3000/login/",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
