import type {
  CheckinPatch,
  CheckinRow,
  CheckinsRepository,
  HabitRow,
  HabitsRepository,
} from "../../src/repositories/tracking.repository.js";
import { AppError } from "../../src/utils/AppError.js";
import type { FakeStore } from "./accountRepository.js";

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export class FakeCheckinsRepository implements CheckinsRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}
  private own() {
    return this.s.checkins.filter((c) => c.user_id === this.userId);
  }
  async list(from: string, to: string) {
    return this.own()
      .filter((c) => c.checkin_date >= from && c.checkin_date <= to)
      .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date));
  }
  async get(date: string) {
    return this.own().find((c) => c.checkin_date === date) ?? null;
  }
  async upsert(date: string, patch: CheckinPatch) {
    const now = new Date().toISOString();
    let row = this.own().find((c) => c.checkin_date === date);
    if (!row) {
      row = {
        id: crypto.randomUUID(),
        user_id: this.userId,
        checkin_date: date,
        weight_kg: null,
        waist_cm: null,
        steps: null,
        sleep_hours: null,
        sleep_quality: null,
        hunger: null,
        energy: null,
        notes: null,
        created_at: now,
        updated_at: now,
      } satisfies CheckinRow;
      this.s.checkins.push(row);
    }
    Object.assign(row, defined(patch), { updated_at: now });
    return { ...row };
  }
  async delete(date: string) {
    const i = this.s.checkins.findIndex((c) => c.user_id === this.userId && c.checkin_date === date);
    if (i < 0) return false;
    this.s.checkins.splice(i, 1);
    return true;
  }
}

export class FakeHabitsRepository implements HabitsRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}
  private own() {
    return this.s.habits.filter((h) => h.user_id === this.userId);
  }
  async list(includeInactive: boolean) {
    return this.own()
      .filter((h) => includeInactive || h.is_active)
      .sort((a, b) => a.position - b.position);
  }
  async get(id: string) {
    return this.own().find((h) => h.id === id) ?? null;
  }
  async getByKey(key: string) {
    return this.own().find((h) => h.key === key) ?? null;
  }
  async create(values: { key: string; name: string; description: string | null; position: number }) {
    if (this.own().some((h) => h.key === values.key)) throw AppError.conflict("This record already exists.");
    const now = new Date().toISOString();
    const row: HabitRow = {
      id: crypto.randomUUID(),
      user_id: this.userId,
      is_active: true,
      created_at: now,
      updated_at: now,
      ...values,
    };
    this.s.habits.push(row);
    return row;
  }
  async update(id: string, values: Partial<Pick<HabitRow, "name" | "description" | "position" | "is_active">>) {
    const row = this.own().find((h) => h.id === id);
    if (!row) return null;
    Object.assign(row, defined(values));
    return { ...row };
  }
  async delete(id: string) {
    const i = this.s.habits.findIndex((h) => h.id === id && h.user_id === this.userId);
    if (i < 0) return false;
    this.s.habits.splice(i, 1);
    this.s.habitLogs = this.s.habitLogs.filter((l) => l.habit_id !== id);
    return true;
  }
  async logs(from: string, to: string) {
    return this.s.habitLogs.filter((l) => l.user_id === this.userId && l.log_date >= from && l.log_date <= to);
  }
  async setLog(habitId: string, date: string, completed: boolean) {
    this.s.habitLogs = this.s.habitLogs.filter((l) => !(l.habit_id === habitId && l.log_date === date));
    if (completed) {
      const now = new Date().toISOString();
      this.s.habitLogs.push({
        id: crypto.randomUUID(),
        habit_id: habitId,
        user_id: this.userId,
        log_date: date,
        completed: true,
        created_at: now,
        updated_at: now,
      });
    }
  }
}
