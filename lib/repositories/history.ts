import { db, SETTINGS_KEYS, type FoodEntry, type GoalSettings } from "@/lib/db";
import { DEFAULT_GOALS, type Macros } from "@/lib/diary";
import type { DayTotals, StatsData } from "@/lib/history";
import type { Action } from "@/lib/types";

/**
 * Репозиторий истории питания (local data layer).
 *
 * Заменяет server actions + lib/history.ts из /nutriarium-base. Отдельная
 * таблица истории не нужна: объём персональных данных мал, итоги по дням
 * считаются из entries в JS. Snapshot-значения умножаются на quantity,
 * поэтому история всегда показывает КБЖУ на момент записи.
 */

/** Итоги по всем дням (для списка истории), новые сверху. */
export async function listDayTotals(): Promise<Action<DayTotals[]>> {
  try {
    const entries = await db.entries.toArray();
    const byDate = new Map<string, DayTotals>();
    for (const entry of entries) {
      byDate.set(entry.entryDate, byDate.get(entry.entryDate) ?? {
        date: entry.entryDate,
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
      });
      const day = byDate.get(entry.entryDate)!;
      const m = {
        calories: entry.caloriesSnapshot * entry.quantity,
        protein: entry.proteinSnapshot * entry.quantity,
        fat: entry.fatSnapshot * entry.quantity,
        carbs: entry.carbsSnapshot * entry.quantity,
      };
      day.calories += m.calories;
      day.protein += m.protein;
      day.fat += m.fat;
      day.carbs += m.carbs;
    }
    const days = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
    return { ok: true, data: days };
  } catch (error) {
    console.error("[history] listDayTotals failed:", error);
    return { ok: false, error: "Не удалось загрузить историю" };
  }
}

/** Записи конкретного дня, старые сверху (как в /nutriarium-base). */
export async function listEntriesForDate(entryDate: string): Promise<FoodEntry[]> {
  const entries = await db.entries
    .where("entryDate")
    .equals(entryDate)
    .toArray();
  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return entries;
}

/**
 * Полный экран дня: итоги + записи (только snapshot-значения).
 */
export async function getDayDetail(
  entryDate: string,
): Promise<{ totals: Macros; entries: FoodEntry[] }> {
  const entries = await listEntriesForDate(entryDate);
  const totals = entries.reduce<Macros>(
    (acc, e) => ({
      calories: acc.calories + e.caloriesSnapshot * e.quantity,
      protein: acc.protein + e.proteinSnapshot * e.quantity,
      fat: acc.fat + e.fatSnapshot * e.quantity,
      carbs: acc.carbs + e.carbsSnapshot * e.quantity,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
  return { totals, entries };
}

/**
 * Итоги по дням за период (включая границы). Дни без записей в БД отсутствуют —
 * клиент дополняет их нулями, чтобы линия графика была непрерывной.
 */
export async function dayTotalsSince(
  fromDate: string,
  toDate: string,
): Promise<Action<DayTotals[]>> {
  try {
    const entries = await db.entries
      .where("entryDate")
      .between(fromDate, toDate, true, true)
      .toArray();
    const byDate = new Map<string, DayTotals>();
    for (const entry of entries) {
      byDate.set(entry.entryDate, byDate.get(entry.entryDate) ?? {
        date: entry.entryDate,
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
      });
      const day = byDate.get(entry.entryDate)!;
      day.calories += entry.caloriesSnapshot * entry.quantity;
      day.protein += entry.proteinSnapshot * entry.quantity;
      day.fat += entry.fatSnapshot * entry.quantity;
      day.carbs += entry.carbsSnapshot * entry.quantity;
    }
    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    return { ok: true, data: days };
  } catch (error) {
    console.error("[history] dayTotalsSince failed:", error);
    return { ok: false, error: "Не удалось загрузить статистику" };
  }
}

/**
 * Статистика за период: цели + ряд день-за-днём (пропущенные дни — нули).
 * Локальные даты пользователя fromDate/toDate приходят с клиента.
 */
export async function getStats(
  fromDate: string,
  toDate: string,
): Promise<Action<StatsData>> {
  const [rows, goalsResult] = await Promise.all([
    dayTotalsSince(fromDate, toDate),
    db.settings.get(SETTINGS_KEYS.goals) as Promise<GoalSettings | undefined>,
  ]);
  if (!rows.ok) return rows;

  const goals: Macros = {
    calories: goalsResult && goalsResult.calories > 0 ? goalsResult.calories : DEFAULT_GOALS.calories,
    protein: goalsResult && goalsResult.protein > 0 ? goalsResult.protein : DEFAULT_GOALS.protein,
    fat: goalsResult && goalsResult.fat > 0 ? goalsResult.fat : DEFAULT_GOALS.fat,
    carbs: goalsResult && goalsResult.carbs > 0 ? goalsResult.carbs : DEFAULT_GOALS.carbs,
  };

  const byDate = new Map(rows.data.map((r) => [r.date, r]));
  const days: DayTotals[] = [];
  // Идём по датам как по строкам YYYY-MM-DD: шаг 25h от полудня (реализация
  // /nutriarium-base) терял последний день периода — «сегодня» не попадал
  // в график и в среднее. Полуденный якорь при сдвиге на сутки безопасен
  // для DST (сдвиг не перескакивает дату).
  let cursor = fromDate;
  while (cursor <= toDate) {
    days.push(
      byDate.get(cursor) ?? { date: cursor, calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
    const d = new Date(`${cursor}T12:00:00`);
    d.setDate(d.getDate() + 1);
    cursor = d.toLocaleDateString("en-CA");
  }
  return { ok: true, data: { days, goals } };
}
