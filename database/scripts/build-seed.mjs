/**
 * Generates database/seed/0001_reference_data.sql and database/seed/SEED_REPORT.md
 * from the HTML prototype.
 *
 *   npm run seed:build
 *
 * Nutrition values in the meal plan are copied EXACTLY as written in the
 * prototype. Where an ingredient matches a food-database item it is linked
 * (foodKey) so later quantity edits can be recalculated from the food item;
 * differences between the written value and the calculated value are listed in
 * SEED_REPORT.md rather than silently "corrected".
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extractPrototypeData } from "./extract-prototype.mjs";

const SEED_SQL = fileURLToPath(new URL("../seed/0001_reference_data.sql", import.meta.url));
const REPORT_MD = fileURLToPath(new URL("../seed/SEED_REPORT.md", import.meta.url));

// --- Mappings -----------------------------------------------------------------

/** Plan ingredient name → prototype FOOD_DB id (null = stays a manual line). */
export const INGREDIENT_FOOD_LINKS = {
  "Country Delight Protein Milk": "f_cdmilk",
  "Rolled oats (dry)": "f_oats",
  "Plain high-protein Greek yogurt (check label)": "f_gyogurt",
  "Banana (edible portion)": "f_banana",
  Apple: "f_apple",
  Almonds: "f_almonds",
  "Chia seeds": "f_chia",
  "Toned milk in coffee": "f_tmilk",
  "Sugar in coffee": "f_sugar",
  "Soya chunks": "f_soya",
  "Cooked rice": "f_wrice",
  "Low-fat curd": "f_lfcurd",
  "Low-fat curd marinade": "f_lfcurd",
  Oil: "f_oil",
  "Tomato/onion/spices": "f_tomonion",
  "Low-fat paneer": "f_lfpaneer",
  "Whole-wheat atta": "f_atta",
  "Mixed vegetables": "f_mixveg",
  "Moong dal": "f_moong",
  Spinach: "f_spinach",
  "Chicken breast": "f_chicken",
  Besan: "f_besan",
  Rajma: "f_rajma",
  "Cucumber salad": "f_cucumber",
  "Whole eggs": "f_egg",
  Chickpeas: "f_chole",
};

const FOOD_DIET = { f_egg: "egg", f_chicken: "non_veg" };

const FOOD_NOTES = {
  f_cdmilk:
    "Country Delight Natural Fresh Cow Milk. Verified: 450 ml = 293 kcal, 25 g protein. Carbs/fat not seeded (no verified label values).",
  f_gyogurt: "Brands vary widely — check your pack label.",
  f_lfpaneer: "Brands vary — check your pack label.",
  f_egg: "Whole egg only (rule: never separate whites).",
};

const SLOT_MAP = { postWorkout: "post_workout", breakfast: "breakfast", lunch: "lunch", dinner: "dinner" };
const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const STRICT_VEG_DAYS = new Set(["Tue"]);

// --- Helpers ------------------------------------------------------------------

function foodBasis(food) {
  if (food.mode === "unit") return "per_unit";
  return food.unit === "ml" ? "per_100ml" : "per_100g";
}

/** "60 g dry" → { quantity: 60, unit: "g" }; "2 large" (eggs) → { 2, "egg" }; "as needed" → nulls. */
function parseQuantity(label, food) {
  const match = /^(\d+(?:\.\d+)?)\s*([a-z]+)?/i.exec(label.trim());
  if (!match) return { quantity: null, unit: null };
  const quantity = Number(match[1]);
  let unit = (match[2] ?? "").toLowerCase() || null;
  if (food?.mode === "unit") unit = food.unit; // e.g. "2 large" eggs → unit "egg"
  return { quantity, unit };
}

function computeFromFood(food, quantity) {
  const factor = food.mode === "unit" ? quantity : quantity / 100;
  return { kcal: food.kcal * factor, protein: food.p * factor };
}

const round1 = (n) => Math.round(n * 10) / 10;
const sqlText = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const sqlNum = (v) => (v === null || v === undefined ? "null" : String(v));

// --- Build ----------------------------------------------------------------------

export function buildSeed(data = extractPrototypeData()) {
  const foodById = new Map(data.foods.map((f) => [f.id, f]));
  const discrepancies = [];
  const unlinked = new Set();

  const days = data.days.map((day) => {
    const plan = data.plan[day.key];
    const meals = data.slots.map((slot) => {
      const meal = plan[slot.id];
      const ingredients = meal.ingredients.map((ing) => {
        const foodKey = INGREDIENT_FOOD_LINKS[ing.name] ?? null;
        const food = foodKey ? foodById.get(foodKey) : null;
        if (foodKey && !food) throw new Error(`Unknown food key ${foodKey}`);
        if (!food) unlinked.add(ing.name);
        const { quantity, unit } = parseQuantity(ing.qty, food);
        if (food) {
          const expectedUnit = food.mode === "unit" ? food.unit : food.unit;
          if (unit !== expectedUnit) {
            throw new Error(`Unit mismatch for "${ing.name}" (${ing.qty}): parsed ${unit}, food uses ${expectedUnit}`);
          }
          const calc = computeFromFood(food, quantity);
          const dk = round1(ing.kcal - calc.kcal);
          const dp = round1(ing.protein - calc.protein);
          if (Math.abs(dk) >= 1 || Math.abs(dp) >= 0.5) {
            discrepancies.push({
              where: `${day.full} · ${slot.label} · ${meal.title}`,
              ingredient: `${ing.name} (${ing.qty})`,
              plan: `${ing.kcal} kcal / ${ing.protein} g`,
              calc: `${round1(calc.kcal)} kcal / ${round1(calc.protein)} g`,
            });
          }
        }
        return {
          name: ing.name,
          qtyLabel: ing.qty,
          quantity,
          unit,
          kcal: ing.kcal,
          proteinG: ing.protein,
          carbsG: null,
          fatG: null,
          dietType: food ? (FOOD_DIET[foodKey] ?? "veg") : "veg",
          foodKey,
        };
      });
      return { slot: SLOT_MAP[slot.id], title: meal.title, note: meal.note ?? null, ingredients };
    });
    return { weekday: WEEKDAY[day.key], isStrictVeg: STRICT_VEG_DAYS.has(day.key), meals };
  });

  // Snacks keep their exact planned totals as one line; the per-item breakdown
  // is kept in the description (the prototype gives per-item kcal but not protein).
  const snacks = [
    ...data.snacks.sweet.map((s) => ({ ...s, kind: "sweet" })),
    ...data.snacks.salty.map((s) => ({ ...s, kind: "salty" })),
  ].map((s) => ({
    kind: s.kind,
    name: s.name,
    description: s.detail,
    ingredients: [
      {
        name: `${s.name} (as planned)`,
        qtyLabel: "1 serving",
        quantity: 1,
        unit: "serving",
        kcal: s.kcal,
        proteinG: s.protein,
        carbsG: null,
        fatG: null,
        dietType: "veg",
        foodKey: null,
      },
    ],
  }));

  const mealPlan = { version: 1, name: "7-Day Indian Fat Loss & Muscle Plan", days, snacks };
  const groceries = data.groceries.map((g) => ({ name: g.name, quantityLabel: g.qty }));
  const targets = { caloriesKcal: 2200, proteinG: 160, steps: 6000, creatineG: 5, bmrKcal: 1901, tdeeKcal: 2550 };
  const preferences = {
    wholeEggsOnly: true,
    excludedFoods: ["tofu"],
    foodPreferences:
      "Mostly vegetarian; chicken occasionally. Prefer low-calorie, high-volume meals. Common foods: oats, fruit, nuts, curd, paneer, soya chunks, dal, rice, roti, coffee. Measure cooking oil, milk and sugar.",
  };

  return { foods: data.foods, mealPlan, groceries, targets, preferences, discrepancies, unlinked: [...unlinked] };
}

function renderSql(seed) {
  const foodRows = seed.foods.map((f) => {
    const isCdMilk = f.id === "f_cdmilk";
    return `  (${[
      sqlText(f.id),
      sqlText(isCdMilk ? "Country Delight Protein Milk (Natural Fresh Cow Milk)" : f.name),
      sqlText(foodBasis(f)),
      sqlText(f.unit),
      sqlNum(f.defaultAmt),
      sqlNum(f.kcal),
      sqlNum(f.p),
      isCdMilk ? "null" : sqlNum(f.c),
      isCdMilk ? "null" : sqlNum(f.f),
      sqlText(FOOD_DIET[f.id] ?? "veg"),
      sqlText(FOOD_NOTES[f.id] ?? null),
    ].join(", ")})`;
  });

  const json = (v) => {
    const s = JSON.stringify(v, null, 2);
    if (s.includes("$seed$")) throw new Error("Seed JSON contains the dollar-quote delimiter");
    return `$seed$${s}$seed$::jsonb`;
  };

  return `-- =============================================================================
-- 0001_reference_data.sql — GENERATED by database/scripts/build-seed.mjs
-- Do not edit by hand: change the generator (or the prototype) and re-run
--   npm run seed:build
-- Idempotent: safe to run repeatedly (upserts on stable keys).
-- Source: reference/fitness_pal_7_day_indian_nutrition_ppl_tracker.html
-- =============================================================================

-- Shared reference foods (user_id NULL = visible to every signed-in user).
insert into public.food_items
  (seed_key, name, basis, unit_label, default_amount, kcal, protein_g, carbs_g, fat_g, diet_type, notes)
values
${foodRows.join(",\n")}
on conflict (seed_key) do update set
  name = excluded.name,
  basis = excluded.basis,
  unit_label = excluded.unit_label,
  default_amount = excluded.default_amount,
  kcal = excluded.kcal,
  protein_g = excluded.protein_g,
  carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g,
  diet_type = excluded.diet_type,
  notes = excluded.notes;

-- Templates copied into each new account by private.handle_new_user().
insert into public.app_templates (key, description, payload) values
  ('default_meal_plan', 'Default 7-day Indian meal plan and craving snacks', ${json(seed.mealPlan)}),
  ('default_groceries', 'Default weekly grocery list', ${json(seed.groceries)}),
  ('default_targets', 'Initial daily targets', ${json(seed.targets)}),
  ('default_preferences', 'Initial dietary rules and preferences', ${json(seed.preferences)})
on conflict (key) do update set description = excluded.description, payload = excluded.payload;
`;
}

function renderReport(seed) {
  const rows = seed.discrepancies
    .map((d) => `| ${d.where} | ${d.ingredient} | ${d.plan} | ${d.calc} |`)
    .join("\n");
  return `# Seed data report

_Generated by \`npm run seed:build\`. Do not edit by hand._

- Foods seeded: **${seed.foods.length}**
- Plan days: **${seed.mealPlan.days.length}** (strict-veg: Tuesday)
- Snack options: **${seed.mealPlan.snacks.length}**
- Grocery template items: **${seed.groceries.length}**

## Values kept exactly as written in the plan

The plan's ingredient values are seeded **unchanged**. These linked ingredients differ from what the food database
would calculate for the same quantity (≥ 1 kcal or ≥ 0.5 g protein). The plan value is what the app shows. If you
edit the quantity of one of these ingredients, the app recalculates it from the food database.

| Where | Ingredient | Plan value (kept) | Food-DB calculation |
|---|---|---|---|
${rows || "| — | none | — | — |"}

## Ingredients kept as manual lines (no food-database link)

${seed.unlinked.map((n) => `- ${n}`).join("\n")}

## Deliberate changes from the prototype

- **Country Delight milk carbs and fat are left blank (NULL).** The prototype listed 4.9 g carbs / 2.5 g fat per 100 ml
  without a verified label. kcal (65.1/100 ml → 293 kcal per 450 ml) and protein (5.56/100 ml → 25 g) are unchanged.
- Plan ingredients have no carbs/fat values in the prototype, so they are seeded as unknown (not zero).
- Snack options keep their exact planned totals as a single line. The per-item breakdown is kept in the description.
`;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("build-seed.mjs")) {
  const seed = buildSeed();
  writeFileSync(SEED_SQL, renderSql(seed));
  writeFileSync(REPORT_MD, renderReport(seed));
  console.log(
    `Wrote seed SQL (${seed.foods.length} foods, ${seed.mealPlan.days.length} days) — ${seed.discrepancies.length} value differences recorded in SEED_REPORT.md`,
  );
}
