import type { Db } from "../config/supabase.js";
import type { Database } from "../types/database.types.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";

type Tables = Database["public"]["Tables"];
export type GroceryItemRow = Tables["grocery_list_items"]["Row"];
export interface GroceryListRow {
  id: string;
  name: string;
  generated_at: string | null;
  updated_at: string;
  grocery_list_items: GroceryItemRow[];
}
export interface GeneratedItem {
  name: string;
  quantity_label: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface GroceryRepository {
  current(): Promise<GroceryListRow | null>;
  createList(name: string): Promise<string>;
  addItem(
    listId: string,
    item: { name: string; quantity_label: string | null; position: number },
  ): Promise<GroceryItemRow>;
  updateItem(
    id: string,
    patch: Partial<Pick<GroceryItemRow, "name" | "quantity_label" | "is_purchased">>,
  ): Promise<GroceryItemRow | null>;
  deleteItem(id: string): Promise<boolean>;
  uncheckAll(listId: string): Promise<void>;
  generate(name: string, items: GeneratedItem[]): Promise<string>;
}

export class SupabaseGroceryRepository implements GroceryRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async current() {
    const res = await this.db
      .from("grocery_lists")
      .select("id, name, generated_at, updated_at, grocery_list_items(*)")
      .eq("user_id", this.userId)
      .eq("is_current", true)
      .order("position", { referencedTable: "grocery_list_items", ascending: true })
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data as GroceryListRow | null;
  }

  async createList(name: string) {
    return unwrap(await this.db.from("grocery_lists").insert({ user_id: this.userId, name }).select("id").single()).id;
  }

  async addItem(listId: string, item: { name: string; quantity_label: string | null; position: number }) {
    return unwrap(
      await this.db
        .from("grocery_list_items")
        .insert({ ...item, list_id: listId, user_id: this.userId, source: "custom" })
        .select("*")
        .single(),
    );
  }

  async updateItem(id: string, patch: Partial<Pick<GroceryItemRow, "name" | "quantity_label" | "is_purchased">>) {
    const res = await this.db
      .from("grocery_list_items")
      .update(patch)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("*")
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async deleteItem(id: string) {
    const res = await this.db.from("grocery_list_items").delete().eq("id", id).eq("user_id", this.userId).select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }

  async uncheckAll(listId: string) {
    const res = await this.db
      .from("grocery_list_items")
      .update({ is_purchased: false })
      .eq("user_id", this.userId)
      .eq("list_id", listId)
      .eq("is_purchased", true);
    if (res.error) throw mapDbError(res.error);
  }

  async generate(name: string, items: GeneratedItem[]) {
    return unwrap(await this.db.rpc("generate_my_grocery_list", { p_name: name, p_items: items as never }));
  }
}
