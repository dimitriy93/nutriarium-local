import { db, newId, nowIso, type Food } from "@/lib/db";
import type { Action } from "@/lib/types";
import {
  foodInputSchema,
  foodSearchSchema,
  foodUpdateSchema,
  formatZodError,
  uuidSchema,
  type FoodInput,
  type FoodUpdate,
} from "@/lib/validation";

/**
 * Репозиторий блюд (local data layer).
 *
 * Заменяет server actions + lib/foods.ts из /nutriarium-base: все данные
 * читаются и пишутся напрямую в IndexedDB. Контракт результатов — { ok, data
 * | error } — прежний, поэтому клиентские компоненты меняются минимально.
 *
 * Поиск: запрос режется на слова, блюдо подходит, если каждое слово встречается
 * в названии без учёта регистра (аналог ILIKE из Postgres-версии). Объём
 * персональной базы мал (сотни записей), поэтому фильтрация выполняется в JS.
 */

/** Максимальный размер выдачи списка (пагинация выполняется на клиенте). */
const LIMIT = 500;

/** Максимальное количество слов в поисковом запросе. */
export const MAX_SEARCH_WORDS = 10;

function normalizeName(name: string): string {
  // toLocaleLowerCase("ru") — чтобы «Ё/ё» и прочие регистры сравнивались предсказуемо.
  return name.toLocaleLowerCase("ru");
}

/** Активные блюда (soft-deleted исключены), отсортированные по названию. */
export async function listFoods(): Promise<Action<Food[]>> {
  try {
    const foods = await db.foods
      .orderBy("name")
      .filter((f) => f.deletedAt === null)
      .limit(LIMIT)
      .toArray();
    return { ok: true, data: foods };
  } catch (error) {
    console.error("[foods] list failed:", error);
    return { ok: false, error: "Не удалось загрузить базу блюд" };
  }
}

/**
 * Поиск по названию: каждое слово запроса должно встретиться в названии
 * (без учёта регистра). Пустой запрос = весь список. Soft-deleted исключены.
 */
export async function searchFoods(rawQuery: string): Promise<Action<Food[]>> {
  const parsed = foodSearchSchema.safeParse(rawQuery);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const words = parsed.data
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_WORDS);

  if (words.length === 0) {
    return listFoods();
  }

  try {
    const needles = words.map(normalizeName);
    const foods = await db.foods
      .orderBy("name")
      .filter(
        (f) =>
          f.deletedAt === null &&
          needles.every((n) => normalizeName(f.name).includes(n)),
      )
      .limit(LIMIT)
      .toArray();
    return { ok: true, data: foods };
  } catch (error) {
    console.error("[foods] search failed:", error);
    return { ok: false, error: "Не удалось выполнить поиск" };
  }
}

/**
 * Последние использованные блюда (для быстрого выбора в дневнике): блюда из
 * записей дневника, отсортированные по дате последнего употребления. Если
 * записей ещё нет — первые блюда справочника по названию.
 */
export async function listRecentFoods(limit = 6): Promise<Action<Food[]>> {
  try {
    const [entries, activeFoods] = await Promise.all([
      db.entries.toArray(),
      db.foods.filter((f) => f.deletedAt === null).toArray(),
    ]);
    const byId = new Map(activeFoods.map((f) => [f.id, f]));
    const lastUsed = new Map<string, string>();
    for (const entry of entries) {
      const prev = lastUsed.get(entry.foodId);
      if (!prev || entry.createdAt > prev) {
        lastUsed.set(entry.foodId, entry.createdAt);
      }
    }
    const recent = [...lastUsed.entries()]
      .map(([id, usedAt]) => ({ food: byId.get(id), usedAt }))
      .filter((r): r is { food: Food; usedAt: string } => r.food !== undefined)
      .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
      .slice(0, limit)
      .map((r) => r.food);

    if (recent.length > 0) {
      return { ok: true, data: recent };
    }
    // Записей дневника ещё нет — вызывающий код сам решает, что показать
    // (в дневнике это первые блюда справочника через listFoods()).
    return { ok: true, data: [] };
  } catch (error) {
    console.error("[foods] recent failed:", error);
    return { ok: false, error: "Не удалось загрузить последние блюда" };
  }
}

/** Одно блюдо по id. Возвращает null, если не найдено или удалено. */
export async function getFoodById(id: string): Promise<Food | null> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return null;
  const food = await db.foods.get(parsed.data);
  return food && food.deletedAt === null ? food : null;
}

/** Создание блюда. source='ai' — когда значения пришли из подтверждённого AI-расчёта. */
export async function createFood(
  input: FoodInput,
  options?: { source?: "ai" | "manual" },
): Promise<Action<Food>> {
  const parsed = foodInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const source = options?.source ?? "manual";
  const food: Food = {
    id: newId(),
    ...parsed.data,
    source,
    lastAiCheckedAt: null,
    deletedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  try {
    await db.foods.add(food);
    return { ok: true, data: food };
  } catch (error) {
    console.error("[foods] create failed:", error);
    return { ok: false, error: "Не удалось сохранить блюдо" };
  }
}

/**
 * Обновление блюда (название и/или КБЖУ). Ручное редактирование переводит
 * source в 'manual'. Удалённое блюдо не изменяется.
 */
export async function updateFood(
  id: string,
  patch: FoodUpdate,
  options?: { source?: "ai" | "manual"; touchAiChecked?: boolean },
): Promise<Action<Food>> {
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: formatZodError(idParsed.error) };
  }
  const patchParsed = foodUpdateSchema.safeParse(patch);
  if (!patchParsed.success) {
    return { ok: false, error: formatZodError(patchParsed.error) };
  }

  try {
    const existing = await db.foods.get(idParsed.data);
    if (!existing || existing.deletedAt !== null) {
      return { ok: false, error: "Блюдо не найдено" };
    }

    const updated: Food = {
      ...existing,
      ...patchParsed.data,
      updatedAt: nowIso(),
    };
    // Ручное редактирование по умолчанию переводит источник в 'manual'
    // (как server action updateFood в /nutriarium-base).
    updated.source = options?.source ?? "manual";
    if (options?.touchAiChecked) updated.lastAiCheckedAt = nowIso();

    await db.foods.put(updated);
    return { ok: true, data: updated };
  } catch (error) {
    console.error("[foods] update failed:", error);
    return { ok: false, error: "Не удалось сохранить блюдо" };
  }
}

/**
 * Soft delete: только deletedAt = now, строка остаётся в IndexedDB.
 * Записи дневника не затрагиваются — они хранят snapshot. Возвращает ошибку,
 * если блюдо уже удалено/не найдено.
 */
export async function softDeleteFood(id: string): Promise<Action<true>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  try {
    const existing = await db.foods.get(parsed.data);
    if (!existing || existing.deletedAt !== null) {
      return { ok: false, error: "Блюдо не найдено или уже удалено" };
    }
    await db.foods.update(parsed.data, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
    return { ok: true, data: true };
  } catch (error) {
    console.error("[foods] delete failed:", error);
    return { ok: false, error: "Не удалось удалить блюдо" };
  }
}
