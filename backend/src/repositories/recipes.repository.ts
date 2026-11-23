import type { Db } from "../config/supabase.js";
import type { Database } from "../types/database.types.js";
import type { IngredientLine } from "../services/ingredients.service.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";

type Tables = Database["public"]["Tables"];
export type RecipeRow = Tables["recipes"]["Row"];
export type RecipeIngredientRow = Tables["recipe_ingredients"]["Row"];
export type RecipeWithIngredients = RecipeRow & { recipe_ingredients: RecipeIngredientRow[] };

export type RecipeCategory = "meal" | "snack_sweet" | "snack_salty";

export interface RecipeSave {
  name: string;
  category: RecipeCategory;
  description: string | null;
  servings: number;
  ingredients: IngredientLine[];
}

export interface RecipesRepository {
  list(category?: RecipeCategory): Promise<RecipeWithIngredients[]>;
  get(id: string): Promise<RecipeWithIngredients | null>;
  /** Creates (id null) or replaces a recipe and all its ingredients atomically. Returns the id. */
  save(id: string | null, recipe: RecipeSave): Promise<string>;
  delete(id: string): Promise<boolean>;
}

const SELECT = "*, recipe_ingredients(*)";

export class SupabaseRecipesRepository implements RecipesRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async list(category?: RecipeCategory) {
    let q = this.db.from("recipes").select(SELECT).eq("user_id", this.userId);
    if (category) q = q.eq("category", category);
    const rows = unwrap(
      await q
        .order("name", { ascending: true })
        .order("position", { referencedTable: "recipe_ingredients", ascending: true })
        .limit(500),
    );
    return rows as RecipeWithIngredients[];
  }

  async get(id: string) {
    const res = await this.db
      .from("recipes")
      .select(SELECT)
      .eq("user_id", this.userId)
      .eq("id", id)
      .order("position", { referencedTable: "recipe_ingredients", ascending: true })
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data as RecipeWithIngredients | null;
  }

  async save(id: string | null, recipe: RecipeSave) {
    return unwrap(await this.db.rpc("save_my_recipe", { p_recipe_id: id, p_recipe: recipe as never }));
  }

  async delete(id: string) {
    const res = await this.db.from("recipes").delete().eq("id", id).eq("user_id", this.userId).select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }
}
