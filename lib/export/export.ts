import { db, type Food } from "@/lib/db";
import { getGoals } from "@/lib/repositories/settings";

/**
 * Экспорт данных Nutriarium (для интеграции с Silentium и основы будущего
 * backup). Не копирует внутренние IndexedDB-ключи и технические поля:
 * контракт — стабильная версия `schemaVersion`, на которую может опираться
 * импортирующая сторона.
 */

export const EXPORT_SCHEMA_VERSION = 1 as const;

/** Запись дневника в экспорте: значения — КБЖУ НА ОДНУ ПОРЦИЮ + quantity. */
export interface ExportEntry {
  /** Локальная дата записи YYYY-MM-DD. */
  date: string;
  /** Название блюда (snapshot на момент записи). */
  name: string;
  /** КБЖУ на одну порцию (snapshot на момент записи). */
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Количество порций: итоговое КБЖУ = значения × quantity. */
  quantity: number;
  /** Время создания записи, ISO (UTC). */
  createdAt: string;
}

/** Блюдо справочника в экспорте: КБЖУ на одну порцию. */
export interface ExportFood {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  source: "ai" | "manual";
}

/** Дневные цели пользователя (если заданы). */
export interface ExportGoals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface NutriariumExport {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  source: "nutriarium";
  exportedAt: string;
  data: {
    entries: ExportEntry[];
    foods: ExportFood[];
    goals: ExportGoals;
  };
}

/** Собирает экспортируемый JSON из IndexedDB (чистая структура, без ключей БД). */
export async function buildExport(): Promise<NutriariumExport> {
  const [foods, entries, goals] = await Promise.all([
    db.foods.filter((f) => f.deletedAt === null).toArray(),
    db.entries.toArray(),
    getGoals(),
  ]);

  const sortedEntries = [...entries].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    source: "nutriarium",
    exportedAt: new Date().toISOString(),
    data: {
      entries: sortedEntries.map(
        (e): ExportEntry => ({
          date: e.entryDate,
          name: e.nameSnapshot,
          calories: e.caloriesSnapshot,
          protein: e.proteinSnapshot,
          fat: e.fatSnapshot,
          carbs: e.carbsSnapshot,
          quantity: e.quantity,
          createdAt: e.createdAt,
        }),
      ),
      foods: foods
        .sort((a: Food, b: Food) => a.name.localeCompare(b.name, "ru"))
        .map(
          (f): ExportFood => ({
            name: f.name,
            calories: f.calories,
            protein: f.protein,
            fat: f.fat,
            carbs: f.carbs,
            source: f.source,
          }),
        ),
      goals: {
        calories: goals.calories,
        protein: goals.protein,
        fat: goals.fat,
        carbs: goals.carbs,
      },
    },
  };
}
