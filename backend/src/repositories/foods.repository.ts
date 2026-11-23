import type { Db } from "../config/supabase.js";
import type { Database } from "../types/database.types.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";

type Tables = Database["public"]["Tables"];
export type FoodRow = Tables["food_items"]["Row"];
export type FoodWrite = Omit<
  Tables["food_items"]["Insert"],
  "id" | "user_id" | "seed_key" | "created_at" | "updated_at"
>;

export interface FoodSearch {
  q: string | null;
  limit: number;
  offset: number;
}

/** Shared foods (read-only) + the user's own custom foods. */
export interface FoodsRepository {
  search(params: FoodSearch): Promise<FoodRow[]>;
  get(id: string): Promise<FoodRow | null>;
  create(values: FoodWrite): Promise<FoodRow>;
  /** Updates an OWN food; returns null if no own food has that id. */
  update(id: string, values: Partial<FoodWrite>): Promise<FoodRow | null>;
  /** Deletes an OWN food; returns false if no own food has that id. */
  delete(id: string): Promise<boolean>;
}

/** Escapes LIKE wildcards so user input is matched literally. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export class SupabaseFoodsRepository implements FoodsRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  /** Visible = shared (user_id NULL) or own. userId is a verified UUID, safe in the filter. */
  private visible() {
    return this.db.from("food_items").select("*").or(`user_id.is.null,user_id.eq.${this.userId}`);
  }

  async search({ q, limit, offset }: FoodSearch) {
    let query = this.visible();
    if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
    return unwrap(await query.order("name", { ascending: true }).range(offset, offset + limit - 1));
  }

  async get(id: string) {
    const res = await this.visible().eq("id", id).maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async create(values: FoodWrite) {
    return unwrap(
      await this.db
        .from("food_items")
        .insert({ ...values, user_id: this.userId })
        .select("*")
        .single(),
    );
  }

  async update(id: string, values: Partial<FoodWrite>) {
    const res = await this.db
      .from("food_items")
      .update(values)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("*")
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async delete(id: string) {
    const res = await this.db.from("food_items").delete().eq("id", id).eq("user_id", this.userId).select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }
}
