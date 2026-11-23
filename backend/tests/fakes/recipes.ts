import type { RecipeSave, RecipesRepository, RecipeCategory } from "../../src/repositories/recipes.repository.js";
import { AppError } from "../../src/utils/AppError.js";
import type { FakeStore } from "./accountRepository.js";

/** Mirrors SupabaseRecipesRepository + save_my_recipe: own rows only, atomic replace. */
export class FakeRecipesRepository implements RecipesRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}
  private own() {
    return this.s.recipes.filter((r) => r.user_id === this.userId);
  }
  async list(category?: RecipeCategory) {
    return structuredClone(this.own().filter((r) => !category || r.category === category));
  }
  async get(id: string) {
    const r = this.own().find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }
  async save(id: string | null, recipe: RecipeSave) {
    const now = new Date().toISOString();
    let row = id ? this.own().find((r) => r.id === id) : undefined;
    if (id && !row) throw AppError.notFound("Recipe not found");
    if (!row) {
      row = {
        id: crypto.randomUUID(),
        user_id: this.userId,
        name: recipe.name,
        category: recipe.category,
        description: recipe.description,
        servings: recipe.servings,
        created_at: now,
        updated_at: now,
        recipe_ingredients: [],
      };
      this.s.recipes.push(row);
    }
    Object.assign(row, {
      name: recipe.name,
      category: recipe.category,
      description: recipe.description,
      servings: recipe.servings,
      updated_at: now,
    });
    row.recipe_ingredients = recipe.ingredients.map((l, position) => ({
      ...l,
      id: crypto.randomUUID(),
      recipe_id: row.id,
      user_id: this.userId,
      position,
      created_at: now,
      updated_at: now,
    }));
    return row.id;
  }
  async delete(id: string) {
    const i = this.s.recipes.findIndex((r) => r.id === id && r.user_id === this.userId);
    if (i < 0) return false;
    this.s.recipes.splice(i, 1);
    return true;
  }
}
