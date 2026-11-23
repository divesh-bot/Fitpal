import type { Db } from "../config/supabase.js";
import type { Database } from "../types/database.types.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";

type Tables = Database["public"]["Tables"];
export type ProfileRow = Tables["profiles"]["Row"];
export type ProfilePatch = Tables["profiles"]["Update"];
export type TargetsRow = Tables["nutrition_targets"]["Row"];
export type TargetsWrite = Omit<Tables["nutrition_targets"]["Insert"], "user_id" | "id" | "effective_from">;
export type PreferencesRow = Tables["user_preferences"]["Row"];
export type PreferencesPatch = Tables["user_preferences"]["Update"];

/**
 * Data access for profile, targets and preferences. Every method is scoped to
 * the user the repository was created for (explicit filter + RLS).
 */
export interface AccountRepository {
  getProfile(): Promise<ProfileRow>;
  updateProfile(patch: ProfilePatch): Promise<ProfileRow>;
  /** Target version in effect on `date` (latest effective_from <= date), or null. */
  getTargetsOn(date: string): Promise<TargetsRow | null>;
  /** Earliest version (fallback for dates before the first version). */
  getEarliestTargets(): Promise<TargetsRow | null>;
  listTargets(): Promise<TargetsRow[]>;
  upsertTargets(effectiveFrom: string, values: TargetsWrite): Promise<TargetsRow>;
  getPreferences(): Promise<PreferencesRow>;
  updatePreferences(patch: PreferencesPatch): Promise<PreferencesRow>;
}

export class SupabaseAccountRepository implements AccountRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async getProfile() {
    return unwrap(await this.db.from("profiles").select("*").eq("id", this.userId).maybeSingle());
  }

  async updateProfile(patch: ProfilePatch) {
    const { id: _ignored, ...safe } = patch; // never allow changing the key
    return unwrap(await this.db.from("profiles").update(safe).eq("id", this.userId).select("*").maybeSingle());
  }

  async getTargetsOn(date: string) {
    const res = await this.db
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", this.userId)
      .lte("effective_from", date)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async getEarliestTargets() {
    const res = await this.db
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", this.userId)
      .order("effective_from", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async listTargets() {
    return unwrap(
      await this.db
        .from("nutrition_targets")
        .select("*")
        .eq("user_id", this.userId)
        .order("effective_from", { ascending: false })
        .limit(500),
    );
  }

  async upsertTargets(effectiveFrom: string, values: TargetsWrite) {
    return unwrap(
      await this.db
        .from("nutrition_targets")
        .upsert(
          { ...values, user_id: this.userId, effective_from: effectiveFrom },
          { onConflict: "user_id,effective_from" },
        )
        .select("*")
        .single(),
    );
  }

  async getPreferences() {
    return unwrap(await this.db.from("user_preferences").select("*").eq("user_id", this.userId).maybeSingle());
  }

  async updatePreferences(patch: PreferencesPatch) {
    const { user_id: _ignored, ...safe } = patch;
    return unwrap(
      await this.db.from("user_preferences").update(safe).eq("user_id", this.userId).select("*").maybeSingle(),
    );
  }
}
