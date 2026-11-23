import { expect, test, type Page } from "@playwright/test";
import { readTestUser } from "./testUser";

/** Fails the test on any browser console error or 5xx API response. */
function watchForErrors(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  return problems;
}

async function signIn(page: Page) {
  const user = readTestUser();
  await page.goto("/login/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/today\/$/);
  await expect(page.getByRole("heading", { name: "Daily Nutrition" })).toBeVisible();
}

const kcalLeft = (page: Page, n: string) => expect(page.getByText(`${n} kcal left`)).toBeVisible();

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/today/");
  await expect(page).toHaveURL(/\/login\/$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows a friendly error", async ({ page }) => {
  await page.goto("/login/");
  await page.getByLabel("Email").fill(readTestUser().email);
  await page.getByLabel("Password").fill("definitely-wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  // (Next.js also renders an empty role="alert" route announcer, so filter by text.)
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect." })).toBeVisible();
  await expect(page).toHaveURL(/\/login\/$/);
});

test("Today: the full daily journey", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Full journey runs on desktop; mobile has its own layout test");
  const problems = watchForErrors(page);
  await signIn(page);

  // Starting state for a new account: nothing eaten, plan loaded, 2,200 kcal target.
  await kcalLeft(page, "2,200");
  await expect(page.getByText(/^Planned meals: [\d,]+ kcal$/)).toBeVisible();
  await expect(page.getByRole("complementary").getByText("2,200 kcal")).toBeVisible(); // sidebar targets

  // Tick the post-workout protein milk: +293 kcal / 25 g, and creatine is ticked automatically.
  await page.getByRole("button", { name: /^Tick Post-Workout/ }).click();
  await kcalLeft(page, "1,907");
  await expect(page.getByText("135g remaining")).toBeVisible();
  await expect(page.getByRole("button", { name: "Creatine 5g" })).toHaveAttribute("aria-pressed", "true");

  // Quick-add an extra food.
  await page.getByRole("tab", { name: "Quick add" }).click();
  await page.getByLabel("Food name").fill("Masala chai");
  await page.getByLabel("kcal", { exact: true }).last().fill("80");
  await page.getByLabel("Protein grams").last().fill("2");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText('Logged "Masala chai" (80 kcal)')).toBeVisible();
  await kcalLeft(page, "1,827");

  // Log a food from the list by amount (server calculates 150 g low-fat paneer = 210 kcal).
  await page.getByRole("tab", { name: "From food list" }).click();
  await page.getByRole("searchbox", { name: "Search foods" }).last().fill("low-fat paneer");
  await page
    .getByRole("option", { name: /Low-fat paneer/ })
    .last()
    .click();
  await page.getByLabel("Amount", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText('Logged "Low-fat paneer" (210 kcal)')).toBeVisible();
  await kcalLeft(page, "1,617");

  // Choose the salty snack: Makhana + Chana (129 kcal).
  await page.getByRole("radio", { name: /Makhana \+ Chana/ }).click();
  await kcalLeft(page, "1,488");

  // Edit lunch: rename it. Unchanged ingredient values must stay exactly as stored.
  const lunch = page.getByRole("group", { name: /^Lunch:/ });
  await lunch.getByRole("button", { name: "Show ingredients" }).click();
  const before = await lunch.locator("tbody td:nth-child(3)").allTextContents();
  await lunch.getByRole("button", { name: "Edit Meal" }).click();
  await lunch.getByLabel("Meal Name:").fill("E2E Renamed Lunch");
  await lunch.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved "E2E Renamed Lunch" for every/)).toBeVisible();
  const renamed = page.getByRole("group", { name: "Lunch: E2E Renamed Lunch" });
  await expect(renamed).toBeVisible();
  // The card stays expanded after editing, so the ingredient table is already shown.
  await expect(renamed.getByRole("button", { name: "Hide ingredients" })).toBeVisible();
  expect(await renamed.locator("tbody td:nth-child(3)").allTextContents()).toEqual(before);

  // Reset checkmarks (with confirmation): ticks and snack cleared, logged foods kept (80 + 210).
  await page.getByRole("button", { name: "Reset Checkmarks" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click();
  await kcalLeft(page, "1,910");
  await expect(page.getByRole("button", { name: "Creatine 5g" })).toHaveAttribute("aria-pressed", "false");

  // Data persists after a full reload (it comes from the database, not the browser).
  await page.reload();
  await kcalLeft(page, "1,910");
  await expect(page.getByRole("group", { name: "Lunch: E2E Renamed Lunch" })).toBeVisible();

  await page.screenshot({ path: "test-results/screens/today-desktop.png", fullPage: true });

  // Sign out → protected pages redirect to login again.
  await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);
  await page.goto("/today/");
  await expect(page).toHaveURL(/\/login\/$/);

  expect(problems).toEqual([]);
});

test("Today on a phone: bottom tabs, header and ticking a meal", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Mobile layout only");
  const problems = watchForErrors(page);
  await signIn(page);

  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await expect(tabs).toBeVisible();
  for (const name of ["Today", "Calc", "Progress", "Grocery", "Plan"])
    await expect(tabs.getByRole("link", { name })).toBeVisible();
  await expect(page.getByRole("complementary")).toBeHidden(); // desktop sidebar hidden on phones

  const before = await page
    .getByText(/kcal (left|over)$/)
    .first()
    .textContent();
  await page.getByRole("button", { name: /^Tick Breakfast/ }).click();
  await expect(page.getByRole("button", { name: /^Untick Breakfast/ })).toBeVisible();
  await expect(page.getByText(/kcal (left|over)$/).first()).not.toHaveText(before!);
  await page.getByRole("button", { name: /^Untick Breakfast/ }).click();
  await expect(page.getByText(/kcal (left|over)$/).first()).toHaveText(before!);

  // No horizontal scrolling on a phone.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.screenshot({ path: "test-results/screens/today-mobile.png", fullPage: true });
  expect(problems).toEqual([]);
});
