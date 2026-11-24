import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { signIn, watchForErrors, withFreshUser } from "./helpers";

const user = withFreshUser();

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "Plan & Rules journeys run on desktop");
});

test("weekly plan: edit a meal, veg-day rule, export / import / reset", async ({ page }) => {
  const problems = watchForErrors(page);
  await signIn(page, user());
  await page.goto("/plan/");
  await expect(page.getByRole("heading", { name: "Plan & Rules" })).toBeVisible();

  // Monday is open by default: rename its dinner via the shared editor.
  await page.getByRole("button", { name: "Edit Monday Dinner" }).click();
  await page.getByLabel("Meal Name:").fill("E2E Plan Dinner");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText('Saved "E2E Plan Dinner" for every Monday')).toBeVisible();

  // Wednesday has chicken, so it can't be made strictly vegetarian.
  const wednesday = page.getByRole("region", { name: "Wednesday" });
  // The server refuses, so the box must stay unticked (check() would demand it changes).
  await wednesday.getByRole("checkbox", { name: "Strictly veg" }).click();
  await expect(page.getByText(/contains egg or non-veg items/)).toBeVisible();
  await expect(wednesday.getByRole("checkbox", { name: "Strictly veg" })).not.toBeChecked();

  // Export downloads a FitPal v1 file with 7 days and the edited meal.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export Plan (JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^fitpal-plan-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(exported.version).toBe(1);
  expect(exported.days).toHaveLength(7);
  expect(JSON.stringify(exported)).toContain("E2E Plan Dinner");

  // Import the original prototype's export format (version 2).
  const prototypeFile = {
    version: 2,
    vegDays: { Tue: true },
    plan: {
      Mon: {
        lunch: {
          title: "Imported Soya Bowl",
          ingredients: [{ name: "Soya chunks", qty: "60 g dry", kcal: 207, protein: 31 }],
        },
      },
    },
    snacks: { sweet: [{ id: "x", name: "Fruit Chaat", detail: "Papaya 150g", kcal: 120, protein: 1 }], salty: [] },
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: "prototype-plan.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(prototypeFile)),
  });
  await page.getByRole("alertdialog").getByRole("button", { name: "Import" }).click();
  await expect(page.getByText('Imported "Imported from prototype"')).toBeVisible();
  await expect(page.getByText("Imported Soya Bowl")).toBeVisible();

  // A broken file is rejected before anything is sent.
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
  await expect(page.getByText("Could not read that file — it isn't valid JSON.")).toBeVisible();

  // Reset restores the default plan.
  await page.getByRole("button", { name: "Reset Meals to Default Plan" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset Plan" }).click();
  await expect(page.getByText("Restored the default 7-day nutrition plan")).toBeVisible();
  await expect(page.getByText("Soya Curry Rice Bowl")).toBeVisible();

  expect(problems.filter((p) => !p.includes("422"))).toEqual([]);
});

test("profile, targets, dietary rules and habits", async ({ page }) => {
  const problems = watchForErrors(page);
  await signIn(page, user());
  await page.goto("/plan/");

  // Profile.
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  const profile = page.getByRole("form", { name: "Edit profile" });
  await profile.getByLabel("Name").fill("Divesh");
  await profile.getByLabel("Birth year").fill("1999");
  await profile.getByLabel("Height (cm)").fill("173");
  await profile.getByLabel("Starting weight (kg)").fill("98");
  await profile.getByLabel("Sex").selectOption("male");
  await profile.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await expect(page.getByText(/yrs • Male • 98 kg \(start\) • 173 cm/)).toBeVisible();

  // Targets: a new version from today; history keeps the initial one.
  await page.getByRole("button", { name: "Change" }).click();
  const targets = page.getByRole("form", { name: "Change targets" });
  await targets.getByLabel("Calories (kcal/day)").fill("2100");
  await targets.getByLabel("Protein (g/day)").fill("165");
  await targets.getByRole("button", { name: "Save Targets" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Save targets" }).click();
  await expect(page.getByText("2,100 kcal/day • 165 g protein")).toBeVisible();
  await page.getByText("Target history").click();
  await expect(page.getByText("Initial")).toBeVisible();
  await expect(page.getByRole("complementary").getByText("2,100 kcal")).toBeVisible();

  // Dietary rules: exclude mushroom; the rules card reflects it.
  await page.getByLabel("Food to exclude").fill("Mushroom");
  await page.getByRole("button", { name: "Exclude" }).click();
  await page.getByRole("button", { name: "Save Rules" }).click();
  await expect(page.getByText("Dietary rules saved")).toBeVisible();
  await expect(page.getByText("No tofu, mushroom:")).toBeVisible();
  await expect(page.getByText("Tuesday strictly vegetarian:")).toBeVisible();

  // Habits: add one, hide creatine; Today reflects both.
  await page.getByLabel("New habit name").fill("Drink 3 L water");
  await page.getByRole("button", { name: "Add Habit" }).click();
  await expect(page.getByText('Added habit "Drink 3 L water"')).toBeVisible();
  const creatineRow = page.getByRole("listitem").filter({ has: page.getByLabel("Habit name: Creatine") });
  await creatineRow.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByText('"Creatine" hidden from Today')).toBeVisible();

  await page.goto("/today/");
  await expect(page.getByRole("button", { name: "Drink 3 L water" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Creatine 5g" })).toHaveCount(0);
  await expect(page.getByText("2,100 kcal left")).toBeVisible(); // new target applies today

  await page.goto("/plan/");
  await expect(page.getByText("Soya Curry Rice Bowl")).toBeVisible(); // wait for data before the screenshot
  await expect(page.getByText("No tofu, mushroom:")).toBeVisible();
  await page.screenshot({ path: "test-results/screens/plan-desktop.png", fullPage: true });
  expect(problems).toEqual([]);
});
