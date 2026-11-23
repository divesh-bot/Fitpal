import type { Db } from "../config/supabase.js";
import { SupabaseAccountRepository, type AccountRepository } from "./account.repository.js";
import { SupabaseFoodsRepository, type FoodsRepository } from "./foods.repository.js";
import { SupabaseRecipesRepository, type RecipesRepository } from "./recipes.repository.js";
import { SupabaseMealPlansRepository, type MealPlansRepository } from "./mealPlans.repository.js";
import {
  SupabaseCheckinsRepository,
  SupabaseHabitsRepository,
  type CheckinsRepository,
  type HabitsRepository,
} from "./tracking.repository.js";

/** All repositories for one authenticated request, scoped to that user. */
export interface Repositories {
  account: AccountRepository;
  foods: FoodsRepository;
  recipes: RecipesRepository;
  mealPlans: MealPlansRepository;
  checkins: CheckinsRepository;
  habits: HabitsRepository;
}

export type RepositoriesFactory = (auth: { userId: string; accessToken: string }) => Repositories;

export function createSupabaseRepositories(dbFor: (accessToken: string) => Db): RepositoriesFactory {
  return ({ userId, accessToken }) => {
    const db = dbFor(accessToken);
    return {
      account: new SupabaseAccountRepository(db, userId),
      foods: new SupabaseFoodsRepository(db, userId),
      recipes: new SupabaseRecipesRepository(db, userId),
      mealPlans: new SupabaseMealPlansRepository(db, userId),
      checkins: new SupabaseCheckinsRepository(db, userId),
      habits: new SupabaseHabitsRepository(db, userId),
    };
  };
}
