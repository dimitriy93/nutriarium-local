import { db, newId, nowIso, type Food, type FoodEntry } from "@/lib/db";
import { entryMacros, sumMacros, type Macros } from "@/lib/diary";
import type { Action } from "@/lib/types";
import { formatZodError, uuidSchema } from "@/lib/validation";
import { z } from "zod";

/**
 * Репозиторий дневника питания (local data layer).
 *
 * Заменяет server actions + lib/diary.ts из /nutriarium-base. Snapshot-подход
 * сохранён: при создании записи КБЖУ и название блюда фиксируются в самой
 * записи, поэтому будущее редактирование/удаление блюда историю не меняет.
 * entryDate — локальная дата пользователя YYYY-MM-DD (приходит с клиента).
 */

const entryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата");

const quantitySchema = z
  .number({ message: "Количество порций должно быть числом" })
  .min(0.25, "Минимум 0.25 порции")
  .max(50, "Слишком большое количество порций");

/** Записи за день, новые сверху. */
export async function listEntriesForDay(entryDate: string): Promise<Action<FoodEntry[]>> {
  const parsed = entryDateSchema.safeParse(entryDate);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  try {
    const entries = await db.entries
      .where("entryDate")
      .equals(parsed.data)
      .toArray();
    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true, data: entries };
  } catch (error) {
    console.error("[diary] list failed:", error);
    return { ok: false, error: "Не удалось загрузить записи дневника" };
  }
}

/**
 * Суммарное КБЖУ за день: snapshot * quantity по ВСЕМ записям дня.
 * Пагинация списка на UI не влияет — totals всегда считаются по всем записям.
 * Пустой день — нули.
 */
export async function dailyTotals(entryDate: string): Promise<Action<Macros>> {
  const result = await listEntriesForDay(entryDate);
  if (!result.ok) return result;
  return { ok: true, data: sumMacros(result.data) };
}

export interface CreateEntryInput {
  foodId: string;
  entryDate: string;
  quantity: number;
}

/**
 * Создание записи: блюдо читается из IndexedDB (активное), КБЖУ и название
 * фиксируются в snapshot-полях новой записи.
 */
export async function createEntry(input: CreateEntryInput): Promise<Action<FoodEntry>> {
  const parsed = z
    .object({
      foodId: uuidSchema,
      entryDate: entryDateSchema,
      quantity: quantitySchema,
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  try {
    const food: Food | undefined = await db.foods.get(parsed.data.foodId);
    if (!food || food.deletedAt !== null) {
      return { ok: false, error: "Блюдо не найдено" };
    }

    const entry: FoodEntry = {
      id: newId(),
      foodId: food.id,
      entryDate: parsed.data.entryDate,
      nameSnapshot: food.name,
      caloriesSnapshot: food.calories,
      proteinSnapshot: food.protein,
      fatSnapshot: food.fat,
      carbsSnapshot: food.carbs,
      quantity: parsed.data.quantity,
      createdAt: nowIso(),
    };
    await db.entries.add(entry);
    return { ok: true, data: entry };
  } catch (error) {
    console.error("[diary] create failed:", error);
    return { ok: false, error: "Не удалось добавить запись" };
  }
}

/** Удаление записи. Возвращает ошибку, если запись не найдена. */
export async function deleteEntry(id: string): Promise<Action<true>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  try {
    const existing = await db.entries.get(parsed.data);
    if (!existing) {
      return { ok: false, error: "Запись не найдена" };
    }
    await db.entries.delete(parsed.data);
    return { ok: true, data: true };
  } catch (error) {
    console.error("[diary] delete failed:", error);
    return { ok: false, error: "Не удалось удалить запись" };
  }
}

export { entryMacros };
