import type { FoodsRepository } from "../repositories/foods.repository.js";
import type {
  GeneratedItem,
  GroceryItemRow,
  GroceryListRow,
  GroceryRepository,
} from "../repositories/grocery.repository.js";
import type { MealPlansRepository } from "../repositories/mealPlans.repository.js";
import { AppError } from "../utils/AppError.js";

export interface GroceryItemDto {
  id: string;
  name: string;
  quantityLabel: string | null;
  isPurchased: boolean;
  source: "generated" | "custom" | "template";
  position: number;
}
export interface GroceryListDto {
  id: string;
  name: string;
  generatedAt: string | null;
  items: GroceryItemDto[];
  purchased: number;
  total: number;
}

const toItemDto = (i: GroceryItemRow): GroceryItemDto => ({
  id: i.id,
  name: i.name,
  quantityLabel: i.quantity_label,
  isPurchased: i.is_purchased,
  source: i.source as GroceryItemDto["source"],
  position: i.position,
});

const toListDto = (l: GroceryListRow): GroceryListDto => {
  const items = [...l.grocery_list_items].sort((a, b) => a.position - b.position).map(toItemDto);
  return {
    id: l.id,
    name: l.name,
    generatedAt: l.generated_at,
    items,
    purchased: items.filter((i) => i.isPurchased).length,
    total: items.length,
  };
};

/** Current list, created empty on first use. */
async function currentList(repo: GroceryRepository) {
  const list = await repo.current();
  if (list) return list;
  await repo.createList("Weekly groceries");
  return (await repo.current())!;
}

export async function getCurrentList(repo: GroceryRepository) {
  return toListDto(await currentList(repo));
}

export async function addItem(
  repo: GroceryRepository,
  input: { name: string; quantityLabel?: string | null | undefined },
) {
  const list = await currentList(repo);
  if (list.grocery_list_items.length >= 300) throw AppError.badRequest("The list is full (300 items).");
  const position = Math.max(-1, ...list.grocery_list_items.map((i) => i.position)) + 1;
  await repo.addItem(list.id, { name: input.name, quantity_label: input.quantityLabel ?? "As needed", position });
  return getCurrentList(repo);
}

export async function updateItem(
  repo: GroceryRepository,
  id: string,
  input: { name?: string | undefined; quantityLabel?: string | null | undefined; isPurchased?: boolean | undefined },
) {
  const row = await repo.updateItem(id, {
    name: input.name,
    quantity_label: input.quantityLabel,
    is_purchased: input.isPurchased,
  });
  if (!row) throw AppError.notFound("Grocery item not found.");
  return toItemDto(row);
}

export async function deleteItem(repo: GroceryRepository, id: string) {
  if (!(await repo.deleteItem(id))) throw AppError.notFound("Grocery item not found.");
}

export async function uncheckAll(repo: GroceryRepository) {
  const list = await currentList(repo);
  await repo.uncheckAll(list.id);
  return getCurrentList(repo);
}

// ---------- generation from the meal plan ----------

// Up to 2 decimals, no trailing zeros: 1.26, 1.5, 155.
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** 1260 g → "1.26 kg", 3150 ml → "3.15 L", 5 egg → "5 eggs". */
export function formatQuantity(quantity: number, unit: string): string {
  if (unit === "g" && quantity >= 1000) return `${fmt(Math.round(quantity / 10) / 100)} kg`;
  if (unit === "ml" && quantity >= 1000) return `${fmt(Math.round(quantity / 10) / 100)} L`;
  if (unit === "g" || unit === "ml") return `${fmt(quantity)} ${unit}`;
  return `${fmt(quantity)} ${unit}${quantity === 1 || unit.endsWith("s") ? "" : "s"}`;
}

interface PlanLine {
  foodItemId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
}

/**
 * Adds up a week's ingredient quantities. Lines are grouped by food (or name,
 * for manual lines) and unit; lines without a measurable quantity are listed
 * once as "As needed". Quantities are as written in the plan (e.g. rice is
 * cooked weight), so users may adjust what they actually buy.
 */
export function aggregateGroceries(
  lines: readonly PlanLine[],
  foodNames: ReadonlyMap<string, string>,
): GeneratedItem[] {
  const groups = new Map<string, { name: string; unit: string | null; quantity: number; measurable: boolean }>();
  for (const l of lines) {
    const name = (l.foodItemId && foodNames.get(l.foodItemId)) || l.name.trim();
    const measurable = l.quantity !== null && l.quantity > 0 && !!l.unit;
    const key = `${l.foodItemId ?? name.toLowerCase()}|${measurable ? l.unit : "-"}`;
    const g = groups.get(key) ?? { name, unit: measurable ? l.unit : null, quantity: 0, measurable };
    if (measurable) g.quantity += l.quantity!;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({
      name: g.name,
      quantity: g.measurable ? Math.round(g.quantity * 100) / 100 : null,
      unit: g.unit,
      quantity_label: g.measurable && g.unit ? formatQuantity(g.quantity, g.unit) : "As needed",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function generateFromPlan(
  repos: { grocery: GroceryRepository; mealPlans: MealPlansRepository; foods: FoodsRepository },
  name?: string,
) {
  const plan = await repos.mealPlans.getActive();
  if (!plan) throw AppError.notFound("You don't have an active meal plan to generate groceries from.");
  const lines = plan.meal_plan_days.flatMap((d) =>
    d.meal_plan_meals.flatMap((m) =>
      m.meal_plan_meal_ingredients.map((i) => ({
        foodItemId: i.food_item_id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
      })),
    ),
  );
  const foodIds = lines.map((l) => l.foodItemId).filter((id): id is string => id !== null);
  const foodNames = new Map((await repos.foods.getMany(foodIds)).map((f) => [f.id, f.name]));
  const items = aggregateGroceries(lines, foodNames);
  await repos.grocery.generate(name ?? `Groceries for ${plan.name}`.slice(0, 120), items);
  return getCurrentList(repos.grocery);
}
