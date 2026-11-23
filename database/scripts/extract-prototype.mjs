/**
 * Extracts the built-in data (food DB, 7-day plan, snacks, groceries) from the
 * HTML prototype so seed data is copied exactly rather than retyped by hand.
 *
 * Only the static data section of the prototype's <script> is evaluated, in an
 * isolated `node:vm` context with no access to Node APIs.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PROTOTYPE = fileURLToPath(
  new URL("../../reference/fitness_pal_7_day_indian_nutrition_ppl_tracker.html", import.meta.url),
);

export function extractPrototypeData(path = PROTOTYPE) {
  const html = readFileSync(path, "utf8");
  const start = html.indexOf("const FOOD_DB = [");
  const end = html.indexOf("// 3. STATE MANAGEMENT");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Could not locate the data section in the prototype HTML.");
  }
  const dataSection = html.slice(start, end);
  const script = `${dataSection}
    globalThis.__out = {
      foods: FOOD_DB,
      days: DAYS,
      slots: MEAL_SLOTS,
      plan: createDefaultPlan(),
      snacks: createDefaultSnacks(),
      groceries: DEFAULT_GROCERIES,
    };`;
  const context = vm.createContext(Object.create(null));
  vm.runInContext(script, context, { timeout: 1000 });
  // Round-trip through JSON to detach from the vm realm.
  return JSON.parse(JSON.stringify(context.__out));
}
