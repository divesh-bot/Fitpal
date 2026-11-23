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
import { AppError } from "../../src/utils/AppError.js";

/** In-memory stand-in for the database, keyed by user id (mirrors RLS scoping). */
export class FakeStore {
  profiles = new Map<string, ProfileRow>();
  targets = new Map<string, TargetsRow[]>();
  preferences = new Map<string, PreferencesRow>();

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
    return ({ userId }) => ({ account: new FakeAccountRepository(this, userId) });
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
