import type {
  AccountRepository,
  PreferencesPatch,
  PreferencesRow,
  ProfilePatch,
  ProfileRow,
  TargetsRow,
  TargetsWrite,
} from "../../src/repositories/account.repository.js";
import type { RepositoriesFactory } from "../../src/repositories/index.js";
import type { FoodRow, FoodSearch, FoodsRepository, FoodWrite } from "../../src/repositories/foods.repository.js";
import type { RecipeWithIngredients } from "../../src/repositories/recipes.repository.js";
import { FakeRecipesRepository } from "./recipes.js";
import { AppError } from "../../src/utils/AppError.js";

/** In-memory stand-in for the database, keyed by user id (mirrors RLS scoping). */
export class FakeStore {
  profiles = new Map<string, ProfileRow>();
  targets = new Map<string, TargetsRow[]>();
  preferences = new Map<string, PreferencesRow>();
  /** All food rows (shared ones have user_id null), like the food_items table. */
  foods: FoodRow[] = [];
  recipes: RecipeWithIngredients[] = [];

  /** Adds a shared reference food (as the seed does). */
  seedSharedFood(values: Partial<FoodRow> & Pick<FoodRow, "name">): FoodRow {
    const now = new Date().toISOString();
    const row: FoodRow = {
      id: crypto.randomUUID(),
      user_id: null,
      seed_key: null,
      brand: null,
      basis: "per_100g",
      unit_label: "g",
      default_amount: 100,
      kcal: 100,
      protein_g: 10,
      carbs_g: null,
      fat_g: null,
      diet_type: "veg",
      notes: null,
      created_at: now,
      updated_at: now,
      ...values,
    };
    this.foods.push(row);
    return row;
  }

  /** Mimics the sign-up trigger. */
  seedUser(userId: string, displayName: string | null = null) {
    const now = new Date().toISOString();
    this.profiles.set(userId, {
      id: userId,
      display_name: displayName,
      sex: null,
      birth_year: null,
      height_cm: null,
      starting_weight_kg: null,
      activity_multiplier: 1.34,
      activity_description: null,
      goal: "fat_loss",
      training_notes: null,
      timezone: "Asia/Kolkata",
      created_at: now,
      updated_at: now,
    });
    this.targets.set(userId, [
      {
        id: crypto.randomUUID(),
        user_id: userId,
        effective_from: "1970-01-01",
        calories_kcal: 2200,
        protein_g: 160,
        steps: 6000,
        creatine_g: 5,
        bmr_kcal: 1901,
        tdee_kcal: 2550,
        note: "Initial targets",
        created_at: now,
        updated_at: now,
      },
    ]);
    this.preferences.set(userId, {
      user_id: userId,
      whole_eggs_only: true,
      excluded_foods: ["tofu"],
      food_preferences: null,
      ui_settings: {},
      created_at: now,
      updated_at: now,
    });
  }

  factory(): RepositoriesFactory {
    return ({ userId }) => ({
      account: new FakeAccountRepository(this, userId),
      foods: new FakeFoodsRepository(this, userId),
      recipes: new FakeRecipesRepository(this, userId),
    });
  }
}

/** Mirrors SupabaseFoodsRepository + RLS: sees shared + own; writes own only. */
class FakeFoodsRepository implements FoodsRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}
  private visible() {
    return this.s.foods.filter((f) => f.user_id === null || f.user_id === this.userId);
  }
  async search({ q, limit, offset }: FoodSearch) {
    const needle = q?.toLowerCase();
    return this.visible()
      .filter((f) => !needle || f.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(offset, offset + limit);
  }
  async get(id: string) {
    return this.visible().find((f) => f.id === id) ?? null;
  }
  async getMany(ids: readonly string[]) {
    return this.visible().filter((f) => ids.includes(f.id));
  }
  async create(values: FoodWrite) {
    if (this.visible().some((f) => f.user_id === this.userId && f.name.toLowerCase() === values.name.toLowerCase())) {
      throw AppError.conflict("This record already exists.");
    }
    return this.s.seedSharedFood({ ...(values as Partial<FoodRow>), name: values.name, user_id: this.userId });
  }
  async update(id: string, values: Partial<FoodWrite>) {
    const row = this.s.foods.find((f) => f.id === id && f.user_id === this.userId);
    if (!row) return null;
    Object.assign(row, defined(values), { updated_at: new Date().toISOString() });
    return { ...row };
  }
  async delete(id: string) {
    const i = this.s.foods.findIndex((f) => f.id === id && f.user_id === this.userId);
    if (i < 0) return false;
    this.s.foods.splice(i, 1);
    return true;
  }
}

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

class FakeAccountRepository implements AccountRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}

  async getProfile() {
    const p = this.s.profiles.get(this.userId);
    if (!p) throw AppError.notFound();
    return { ...p };
  }
  async updateProfile(patch: ProfilePatch) {
    const p = await this.getProfile();
    const next = { ...p, ...defined(patch), id: p.id, updated_at: new Date().toISOString() } as ProfileRow;
    this.s.profiles.set(this.userId, next);
    return next;
  }
  private list() {
    return [...(this.s.targets.get(this.userId) ?? [])].sort((a, b) =>
      a.effective_from.localeCompare(b.effective_from),
    );
  }
  async getTargetsOn(date: string) {
    return (
      this.list()
        .filter((t) => t.effective_from <= date)
        .at(-1) ?? null
    );
  }
  async getEarliestTargets() {
    return this.list()[0] ?? null;
  }
  async listTargets() {
    return this.list().reverse();
  }
  async upsertTargets(effectiveFrom: string, values: TargetsWrite) {
    const all = this.s.targets.get(this.userId) ?? [];
    const now = new Date().toISOString();
    const existing = all.find((t) => t.effective_from === effectiveFrom);
    const row: TargetsRow = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: this.userId,
      effective_from: effectiveFrom,
      calories_kcal: values.calories_kcal,
      protein_g: values.protein_g,
      steps: values.steps ?? 6000,
      creatine_g: values.creatine_g ?? 5,
      bmr_kcal: values.bmr_kcal ?? null,
      tdee_kcal: values.tdee_kcal ?? null,
      note: values.note ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.s.targets.set(this.userId, [...all.filter((t) => t.effective_from !== effectiveFrom), row]);
    return row;
  }
  async getPreferences() {
    const p = this.s.preferences.get(this.userId);
    if (!p) throw AppError.notFound();
    return { ...p };
  }
  async updatePreferences(patch: PreferencesPatch) {
    const p = await this.getPreferences();
    const next = { ...p, ...defined(patch), user_id: p.user_id } as PreferencesRow;
    this.s.preferences.set(this.userId, next);
    return next;
  }
}
