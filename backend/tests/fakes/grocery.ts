import type { GeneratedItem, GroceryItemRow, GroceryRepository } from "../../src/repositories/grocery.repository.js";
import type { FakeStore } from "./accountRepository.js";

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Mirrors grocery tables + generate_my_grocery_list (carries unpurchased custom items over). */
export class FakeGroceryRepository implements GroceryRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}
  private currentRow() {
    return this.s.groceryLists.find((l) => l.user_id === this.userId && l.is_current);
  }
  private item(listId: string, v: Partial<GroceryItemRow> & { name: string; position: number }): GroceryItemRow {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      list_id: listId,
      user_id: this.userId,
      quantity_label: null,
      quantity: null,
      unit: null,
      is_purchased: false,
      source: "custom",
      created_at: now,
      updated_at: now,
      ...v,
    };
  }
  async current() {
    const l = this.currentRow();
    return l ? structuredClone(l) : null;
  }
  async createList(name: string) {
    const id = crypto.randomUUID();
    this.s.groceryLists.push({
      id,
      user_id: this.userId,
      is_current: true,
      name,
      generated_at: null,
      updated_at: new Date().toISOString(),
      grocery_list_items: [],
    });
    return id;
  }
  async addItem(listId: string, item: { name: string; quantity_label: string | null; position: number }) {
    const list = this.s.groceryLists.find((l) => l.id === listId && l.user_id === this.userId)!;
    const row = this.item(listId, item);
    list.grocery_list_items.push(row);
    return { ...row };
  }
  private allItems() {
    return this.s.groceryLists.filter((l) => l.user_id === this.userId).flatMap((l) => l.grocery_list_items);
  }
  async updateItem(id: string, patch: Partial<Pick<GroceryItemRow, "name" | "quantity_label" | "is_purchased">>) {
    const row = this.allItems().find((i) => i.id === id);
    if (!row) return null;
    Object.assign(row, defined(patch));
    return { ...row };
  }
  async deleteItem(id: string) {
    for (const l of this.s.groceryLists.filter((x) => x.user_id === this.userId)) {
      const i = l.grocery_list_items.findIndex((x) => x.id === id);
      if (i >= 0) {
        l.grocery_list_items.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  async uncheckAll(listId: string) {
    for (const i of this.allItems()) if (i.list_id === listId) i.is_purchased = false;
  }
  async generate(name: string, items: GeneratedItem[]) {
    const old = this.currentRow();
    if (old) old.is_current = false;
    const id = await this.createList(name);
    const list = this.currentRow()!;
    list.generated_at = new Date().toISOString();
    list.grocery_list_items = items.map((it, position) => this.item(id, { ...it, position, source: "generated" }));
    const carried = (old?.grocery_list_items ?? []).filter((i) => i.source === "custom" && !i.is_purchased);
    carried.forEach((c, k) =>
      list.grocery_list_items.push(
        this.item(id, { name: c.name, quantity_label: c.quantity_label, position: items.length + k }),
      ),
    );
    return id;
  }
}
