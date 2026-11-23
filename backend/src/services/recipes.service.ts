import type { AccountRepository } from "../repositories/account.repository.js";
import type { FoodsRepository } from "../repositories/foods.repository.js";
import type { RecipeCategory, RecipesRepository, RecipeWithIngredients } from "../repositories/recipes.repository.js";
import type { RecipeSaveInput } from "../validators/recipes.validators.js";
import { AppError } from "../utils/AppError.js";
import {
  resolveIngredients,
  strictestDiet,
  toIngredientDto,
  totalsOf,
  type DietRules,
  type DietType,
  type IngredientDto,
} from "./ingredients.service.js";
import type { Macros } from "./nutritionMath.js";

export interface RecipeDto {
  id: string;
  name: string;
  category: RecipeCategory;
  description: string | null;
  servings: number;
  ingredients: IngredientDto[];
  totals: ReturnType<typeof totalsOf>;
  perServing: Macros;
  dietType: DietType;
  updatedAt: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function toRecipeDto(r: RecipeWithIngredients): RecipeDto {
  const ingredients = [...r.recipe_ingredients].sort((a, b) => a.position - b.position).map(toIngredientDto);
  const totals = totalsOf(ingredients);
  const s = r.servings;
  return {
    id: r.id,
    name: r.name,
    category: r.category as RecipeCategory,
    description: r.description,
    servings: s,
    ingredients,
    totals,
    perServing: {
      kcal: Math.round(totals.kcal / s),
      proteinG: r1(totals.proteinG / s),
      carbsG: totals.carbsG === null ? null : r1(totals.carbsG / s),
      fatG: totals.fatG === null ? null : r1(totals.fatG / s),
    },
    dietType: strictestDiet(ingredients.map((i) => i.dietType)),
    updatedAt: r.updated_at,
  };
}

export async function dietRules(account: AccountRepository): Promise<DietRules> {
  const p = await account.getPreferences();
  return { excludedFoods: p.excluded_foods, wholeEggsOnly: p.whole_eggs_only };
}

export async function listRecipes(repo: RecipesRepository, category?: RecipeCategory) {
  return (await repo.list(category)).map(toRecipeDto);
}

export async function getRecipe(repo: RecipesRepository, id: string) {
  const row = await repo.get(id);
  if (!row) throw AppError.notFound("Recipe not found.");
  return toRecipeDto(row);
}

export async function saveRecipe(
  repos: { recipes: RecipesRepository; foods: FoodsRepository; account: AccountRepository },
  id: string | null,
  input: RecipeSaveInput,
) {
  const lines = await resolveIngredients(input.ingredients, repos.foods, await dietRules(repos.account));
  const savedId = await repos.recipes.save(id, {
    name: input.name,
    category: input.category,
    description: input.description ?? null,
    servings: input.servings,
    ingredients: lines,
  });
  return getRecipe(repos.recipes, savedId);
}

export async function deleteRecipe(repo: RecipesRepository, id: string) {
  if (!(await repo.delete(id))) throw AppError.notFound("Recipe not found.");
}
