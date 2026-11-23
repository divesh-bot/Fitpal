import { expect, test, type Page } from "@playwright/test";
import { signIn, watchForErrors, withFreshUser } from "./helpers";

const user = withFreshUser();

/** Local calendar date n days from today, as the app computes it. */
const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function logWeight(page: Page, date: string, kg: string) {
  const form = page.getByRole("form", { name: "Daily check-in" });
  await form.getByLabel("Date").fill(date);
  await form.getByLabel("Morning Weight (kg)").fill(kg);
  await form.getByRole("button", { name: /Save Daily Check-in|Update Check-in/ }).click();
  await expect(page.getByText(/^Saved check-in for/).last()).toBeVisible();
}

test("weigh-ins, 7-day average, chart, edit and delete check-ins", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop journey");
  const problems = watchForErrors(page);
  await signIn(page, user());
  await page.goto("/progress/");
  await expect(page.getByRole("heading", { name: "Log & Progress" })).toBeVisible();
  await expect(page.getByText("No weigh-ins in the last 30 days")).toBeVisible();

  await logWeight(page, isoDaysAgo(2), "98.0");
  await logWeight(page, isoDaysAgo(1), "97.8");
  await logWeight(page, isoDaysAgo(0), "97.6");

  await expect(page.getByText("97.6 kg").first()).toBeVisible(); // latest
  await expect(page.getByText("97.80 kg")).toBeVisible(); // (98.0 + 97.8 + 97.6) / 3
  const chart = page.getByRole("img", { name: "Morning weight and 7-day average, last 30 days" });
  await expect(chart).toBeVisible();
  await expect(page.locator("table.sr-only tbody tr")).toHaveCount(3); // accessible data table

  // Hover shows the tooltip with real values.
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  await expect(page.getByRole("status").filter({ hasText: "Daily Weight: 97.6 kg" })).toBeVisible();

  // Edit today's check-in from the history list.
  await page
    .getByRole("button", { name: /^Edit check-in for/ })
    .first()
    .click();
  const form = page.getByRole("form", { name: "Daily check-in" });
  await expect(form.getByLabel("Morning Weight (kg)")).toHaveValue("97.6");
  await form.getByLabel("Morning Weight (kg)").fill("97.5");
  await form.getByLabel("Notes (optional)").fill("E2E note");
  await form.getByRole("button", { name: "Update Check-in" }).click();
  await expect(page.getByText("97.5 kg").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit check-in for/ }).first()).toContainText("E2E note");

  // Delete the oldest check-in (with confirmation).
  await page
    .getByRole("button", { name: /^Delete check-in for/ })
    .last()
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("table.sr-only tbody tr")).toHaveCount(2);

  await page.screenshot({ path: "test-results/screens/progress-desktop.png", fullPage: true });
  expect(problems).toEqual([]);
});

test("PPL workout: per-set logging, warm-ups excluded, progression, edit, Today tick", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop journey");
  const problems = watchForErrors(page);
  await signIn(page, user());
  await page.goto("/progress/");

  const logger = page.getByRole("form", { name: "Workout logger" });
  await logger.getByLabel("Exercise 1 name").fill("Bench press");
  const sets: [string, string][] = [
    ["10", "40"],
    ["8", "60"],
    ["6", "62.5"],
  ];
  for (const [i, [reps, kg]] of sets.entries()) {
    await logger.getByLabel(`Exercise 1 set ${i + 1} reps`).fill(reps);
    await logger.getByLabel(`Exercise 1 set ${i + 1} weight kg`).fill(kg);
  }
  await logger.getByRole("checkbox", { name: "Warm-up" }).first().check(); // set 1 is a warm-up
  await logger.getByRole("button", { name: "Save Workout" }).click();
  await expect(page.getByText(/Logged push workout for .* · Workout ticked on Today/)).toBeVisible();

  const history = page.getByRole("button", { name: /^Edit Push workout from/ });
  await expect(history).toContainText("Bench press — 2 sets, top 62.5 kg × 6");

  // Progression: best estimated 1RM = 60 × (1 + 8/30) = 76 kg (warm-up excluded).
  await expect(page.getByRole("cell", { name: "76 kg" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "62.5 kg × 6" })).toBeVisible();

  // Edit: change the split to Pull.
  await history.click();
  await expect(page.getByText(/Editing the push workout/)).toBeVisible();
  await logger.getByLabel("Split").selectOption("pull");
  await logger.getByRole("button", { name: "Update Workout" }).click();
  await expect(page.getByRole("button", { name: /^Edit Pull workout from/ })).toBeVisible();

  // Today shows the workout habit ticked.
  await page.goto("/today/");
  await expect(page.getByRole("button", { name: "PPL (~40m)" })).toHaveAttribute("aria-pressed", "true");

  expect(problems).toEqual([]);
});

test("Progress on a phone fits the screen", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Mobile layout only");
  await signIn(page, user());
  await page.goto("/progress/");
  await expect(page.getByRole("heading", { name: "Log & Progress" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/screens/progress-mobile.png", fullPage: true });
});
