import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, type TestUser } from "./testUser";

/**
 * Registers a fresh test user for the current spec file (created before its
 * tests, deleted after). Returns a getter for the user.
 */
export function withFreshUser(): () => TestUser {
  let user: TestUser | null = null;
  test.beforeAll(async () => {
    user = await createTestUser();
  });
  test.afterAll(async () => {
    if (user) await deleteTestUser(user.id);
  });
  return () => {
    if (!user) throw new Error("Test user not created yet");
    return user;
  };
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/today\/$/);
}

/** Collects browser console errors and 5xx API responses so a test can assert there were none. */
export function watchForErrors(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  return problems;
}
