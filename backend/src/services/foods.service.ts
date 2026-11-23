import type { AccountRepository } from "../repositories/account.repository.js";
import type { FoodRow, FoodsRepository, FoodWrite } from "../repositories/foods.repository.js";
import type { FoodCreate, FoodUpdate } from "../validators/foods.validators.js";
import { AppError } from "../utils/AppError.js";
import { matchesExclusion, type FoodBasis } from "./nutritionMath.js";

export interface FoodDto {
  id: string;
  name: string;
  brand: string | null;
  basis: FoodBasis;
  unitLabel: string;
  defaultAmount: number;
  /** Nutrition per 100 g, per 100 ml, or per 1 unit (see `basis`). */
  per: { kcal: number; proteinG: number; carbsG: number | null; fatG: number | null };
  dietType: "veg" | "egg" | "non_veg";
  notes: string | null;
  /** true = shared reference food (read-only); false = the user's own custom food. */
  isShared: boolean;
  /** Matches one of the user's excluded foods (e.g. tofu). Shown with a warning. */
  isExcluded: boolean;
}

export function toFoodDto(r: FoodRow, excluded: readonly string[]): FoodDto {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    basis: r.basis as FoodBasis,
    unitLabel: r.unit_label,
    defaultAmount: r.default_amount,
    per: { kcal: r.kcal, proteinG: r.protein_g, carbsG: r.carbs_g, fatG: r.fat_g },
    dietType: r.diet_type as FoodDto["dietType"],
    notes: r.notes,
    isShared: r.user_id === null,
    isExcluded: matchesExclusion(r.name, excluded),
  };
}

const toWrite = (v: Partial<FoodCreate>): Partial<FoodWrite> => ({
  name: v.name,
  brand: v.brand,
  basis: v.basis,
  unit_label: v.unitLabel,
  default_amount: v.defaultAmount,
  kcal: v.kcal,
  protein_g: v.proteinG,
  carbs_g: v.carbsG,
  fat_g: v.fatG,
  diet_type: v.dietType,
  notes: v.notes,
});

async function excludedFoods(account: AccountRepository) {
  return (await account.getPreferences()).excluded_foods;
}

export async function searchFoods(
  foods: FoodsRepository,
  account: AccountRepository,
  params: { q?: string | undefined; limit: number; offset: number },
) {
  const [rows, excluded] = await Promise.all([
    foods.search({ q: params.q || null, limit: params.limit, offset: params.offset }),
    excludedFoods(account),
  ]);
  return rows.map((r) => toFoodDto(r, excluded));
}

export async function getFood(foods: FoodsRepository, account: AccountRepository, id: string) {
  const row = await foods.get(id);
  if (!row) throw AppError.notFound("Food not found.");
  return toFoodDto(row, await excludedFoods(account));
}

export async function createFood(foods: FoodsRepository, account: AccountRepository, input: FoodCreate) {
  const row = await foods.create(toWrite(input) as FoodWrite);
  return toFoodDto(row, await excludedFoods(account));
}

/** Shared reference foods can't be edited; users create their own version instead. */
async function assertOwn(foods: FoodsRepository, id: string) {
  const existing = await foods.get(id);
  if (!existing) throw AppError.notFound("Food not found.");
  if (existing.user_id === null) {
    throw AppError.forbidden("Built-in foods can't be changed. Create your own food with your pack's label values.");
  }
  return existing;
}

export async function updateFood(foods: FoodsRepository, account: AccountRepository, id: string, input: FoodUpdate) {
  const existing = await assertOwn(foods, id);
  // Keep unit label consistent with basis (g / ml) when basis changes.
  const nextBasis = input.basis ?? existing.basis;
  const unitLabel =
    nextBasis === "per_100g" ? "g" : nextBasis === "per_100ml" ? "ml" : (input.unitLabel ?? existing.unit_label);
  const row = await foods.update(id, toWrite({ ...input, unitLabel } as Partial<FoodCreate>));
  if (!row) throw AppError.notFound("Food not found.");
  return toFoodDto(row, await excludedFoods(account));
}

export async function deleteFood(foods: FoodsRepository, id: string) {
  await assertOwn(foods, id);
  if (!(await foods.delete(id))) throw AppError.notFound("Food not found.");
}
