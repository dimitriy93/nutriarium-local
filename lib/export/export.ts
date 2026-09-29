import { dailyTotals } from "@/lib/repositories/diary";

/**
 * Экспорт Nutriarium → Silentium: ТОЛЬКО текущее суммарное КБЖУ за один день.
 * Никаких продуктов, записей, целей, настроек и API-ключа — пользователь
 * передаёт в другое приложение именно сегодняшние итоги дневника.
 * Контракт — стабильная версия `schemaVersion`, на которую может опираться
 * импортирующая сторона.
 */

export const EXPORT_SCHEMA_VERSION = 1 as const;

export interface NutritionExport {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  source: "nutriarium";
  /** Локальная дата пользователя YYYY-MM-DD (день дневника). */
  date: string;
  /** Суммарное КБЖУ за день на текущий момент (все записи дня). */
  nutrition: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
}

/**
 * Собирает экспорт текущих итогов дня из IndexedDB (чистая структура,
 * без ключей БД). Бросает Error, если день указан неверно или БД недоступна.
 */
export async function buildNutritionExport(date: string): Promise<NutritionExport> {
  const totals = await dailyTotals(date);
  if (!totals.ok) {
    throw new Error(totals.error);
  }
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    source: "nutriarium",
    date,
    nutrition: {
      calories: totals.data.calories,
      protein: totals.data.protein,
      fat: totals.data.fat,
      carbs: totals.data.carbs,
    },
  };
}
