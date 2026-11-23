import { expect, test } from "@playwright/test";
import { signIn, watchForErrors, withFreshUser } from "./helpers";

const user = withFreshUser();

test("grocery: default list, tick, edit, add, delete, uncheck all, generate from plan", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop journey");
  const problems = watchForErrors(page);
  await signIn(page, user());
  await page.goto("/grocery/");
  await expect(page.getByRole("heading", { name: "Weekly Grocery List" })).toBeVisible();

  // A new account starts with the prototype's 16-item list.
  await expect(page.getByText("0 / 16 bought")).toBeVisible();
  const oats = page.getByRole("checkbox", { name: /Rolled oats/ });
  await oats.click();
  await expect(oats).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("1 / 16 bought")).toBeVisible();

  // Edit a quantity inline.
  await page.getByRole("button", { name: "Edit Whole eggs" }).click();
  await page.getByRole("listitem").getByLabel("Quantity").fill("6");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Whole eggs/ })).toContainText("6");

  // Add a custom item, then delete another (with confirmation).
  const form = page.getByRole("form", { name: "Add grocery item" });
  await form.getByLabel("Item name").fill("Green chillies");
  await form.getByLabel("Quantity").fill("100 g");
  await form.getByRole("button", { name: "Add Item" }).click();
  await expect(page.getByText("1 / 17 bought")).toBeVisible();
  await page.getByRole("button", { name: "Remove Rajma" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("1 / 16 bought")).toBeVisible();

  await page.getByRole("button", { name: "Uncheck All" }).click();
  await expect(page.getByText("0 / 16 bought")).toBeVisible();

  // Generate from the default plan: soya chunks are summed across the week; the custom item is kept.
  await page.getByRole("button", { name: "Generate from Plan" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText(/Generated \d+ items from your meal plan/)).toBeVisible();
  // Soya chunks in the default plan: Mon 60 + Tue 35 + Wed 60 + Thu 30 + Sat 40 + Sun 60 = 285 g
  await expect(page.getByRole("checkbox", { name: /Soya chunks/ })).toContainText("285 g");
  await expect(page.getByRole("checkbox", { name: /Green chillies/ })).toBeVisible();

  // Persists across reload (stored in the database).
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Green chillies/ })).toBeVisible();

  await page.screenshot({ path: "test-results/screens/grocery-desktop.png", fullPage: true });
  expect(problems).toEqual([]);
});
