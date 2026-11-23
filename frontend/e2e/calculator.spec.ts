import { expect, test } from "@playwright/test";
import { signIn, withFreshUser, watchForErrors } from "./helpers";

const user = withFreshUser();

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "Calculator journeys run on desktop");
});

async function addFood(page: import("@playwright/test").Page, search: string, option: RegExp, amount: string) {
  await page.getByRole("searchbox", { name: "Search foods" }).fill(search);
  await page.getByRole("option", { name: option }).click();
  await page.getByLabel("Amount", { exact: true }).fill(amount);
  await page.getByRole("button", { name: "+ Add to Builder" }).click();
}

test("meal builder: calculate, save as recipe, log it, and save into the plan", async ({ page }) => {
  const problems = watchForErrors(page);
  await signIn(page, user());
  await page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Calculator" }).click();
  await expect(page.getByRole("heading", { name: "Calorie & Macro Calculator" })).toBeVisible();

  // Live preview: 40 g oats = 156 kcal.
  await page.getByRole("searchbox", { name: "Search foods" }).fill("rolled oats");
  await page.getByRole("option", { name: /Rolled oats/ }).click();
  await page.getByLabel("Amount", { exact: true }).fill("40");
  await expect(page.getByText("156", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "+ Add to Builder" }).click();
  await addFood(page, "banana", /Banana/, "60");

  const totals = page.getByLabel("Builder totals");
  await expect(totals).toContainText("209"); // 156 + 53

  // Save as a recipe, then log it to today from My Recipes.
  await page.getByLabel("Meal name").fill("E2E Oats Bowl");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText('Saved "E2E Oats Bowl"')).toBeVisible();
  const recipe = page.getByRole("listitem").filter({ hasText: "E2E Oats Bowl" });
  await expect(recipe).toContainText("209 kcal");
  await recipe.getByRole("button", { name: "Log today" }).click();
  await expect(page.getByText('Logged "E2E Oats Bowl" (209 kcal) to today')).toBeVisible();

  // Save paneer into Tuesday dinner (allowed), then try eggs on Tuesday (refused by the veg rule).
  await addFood(page, "low-fat paneer", /Low-fat paneer/, "150");
  await page.getByLabel("Meal name").fill("E2E Paneer Plate");
  await page.getByLabel("Save to").selectOption("dinner");
  await page.getByLabel("Day", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText('Saved "E2E Paneer Plate" to Tuesday dinner')).toBeVisible();

  await addFood(page, "whole egg", /Whole egg/, "3");
  await page.getByLabel("Meal name").fill("E2E Omelette");
  await page.getByLabel("Save to").selectOption("dinner");
  await page.getByLabel("Day", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/strictly vegetarian/i).first()).toBeVisible();

  // Today now shows the logged recipe.
  await page.getByRole("navigation", { name: "Main" }).first().getByRole("link", { name: "Today" }).click();
  await expect(page.getByText("E2E Oats Bowl")).toBeVisible();

  expect(problems.filter((p) => !p.includes("422"))).toEqual([]);
});

test("BMR & TDEE: prototype formula and applying new targets", async ({ page }) => {
  const problems = watchForErrors(page);
  await signIn(page, user());
  await page.goto("/calculator/");
  await page.getByRole("tab", { name: "BMR & TDEE Targets" }).click();

  await page.getByLabel("Age (yrs)").fill("27");
  await page.getByLabel("Weight (kg)").fill("98");
  await page.getByLabel("Height (cm)").fill("173");
  await page.getByRole("button", { name: "Steady Cut (-350)" }).click();

  await expect(page.getByText("1,931", { exact: true })).toBeVisible(); // BMR
  await expect(page.getByText("2,588", { exact: true })).toBeVisible(); // TDEE ×1.34
  await expect(page.getByText("2,240", { exact: true })).toBeVisible(); // recommended
  await expect(page.getByText("-0.32 kg/wk")).toBeVisible();

  await page.getByRole("button", { name: "Apply to Daily Targets" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("2,200 → 2,240 kcal");
  await page.getByRole("alertdialog").getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Daily targets updated: 2,240 kcal & 160g protein (from today)")).toBeVisible();
  await expect(page.getByRole("complementary").getByText("2,240 kcal")).toBeVisible(); // sidebar refreshed

  // Profile was saved too: reload and the inputs are pre-filled.
  await page.reload();
  await page.getByRole("tab", { name: "BMR & TDEE Targets" }).click();
  await expect(page.getByLabel("Age (yrs)")).toHaveValue("27");
  await expect(page.getByLabel("Height (cm)")).toHaveValue("173");
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("98"); // saved as starting weight
  await expect(page.getByText("2,240", { exact: true })).toBeVisible(); // so it calculates straight away

  await page.screenshot({ path: "test-results/screens/calculator-tdee.png", fullPage: true });
  expect(problems).toEqual([]);
});
