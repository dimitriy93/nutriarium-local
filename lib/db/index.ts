import Dexie, { type EntityTable } from "dexie";

/**
 * Локальная база Nutriarium Local 2.0.
 *
 * IndexedDB — единственный источник истины; никакой серверной БД нет.
 * Модель повторяет схему /nutriarium-base (snapshot-подход дневника сохранён):
 *
 * - foods   — справочник блюд, КБЖУ на одну порцию; удаление soft (deletedAt);
 * - entries — записи дневника. name/calories/protein/fat/carbs — SNAPSHOT на
 *   момент добавления: последующее редактирование блюда историю не меняет;
 * - settings — key/value: профиль (имя), дневные цели, AI proxy URL.
 */

export interface Food {
  /** UUID (crypto.randomUUID), аналогично прежнему foods.id. */
  id: string;
  name: string;
  /** КБЖУ на одну порцию (порция описана в name). */
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  /** 'ai' — значения пришли из подтверждённого AI-расчёта, 'manual' — иначе. */
  source: "ai" | "manual";
  lastAiCheckedAt: string | null;
  /** Soft delete: null = активно, ISO-строка = удалено. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodEntry {
  id: string;
  foodId: string;
  /** Локальная дата пользователя YYYY-MM-DD (вычисляется на клиенте). */
  entryDate: string;
  nameSnapshot: string;
  caloriesSnapshot: number;
  proteinSnapshot: number;
  fatSnapshot: number;
  carbsSnapshot: number;
  quantity: number;
  createdAt: string;
}

/** Дневные цели пользователя (значения по умолчанию — в lib/diary.ts). */
export interface GoalSettings {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface ProfileSettings {
  displayName: string;
}

/** URL внешнего AI-proxy (ключ хранится только в proxy, не в браузере). */
export interface AiSettings {
  proxyUrl: string;
}

export type SettingsValue = GoalSettings | ProfileSettings | AiSettings;

export const SETTINGS_KEYS = {
  goals: "goals",
  profile: "profile",
  ai: "ai",
} as const;

export const db = new Dexie("nutriarium") as Dexie & {
  foods: EntityTable<Food, "id">;
  entries: EntityTable<FoodEntry, "id">;
  settings: EntityTable<SettingsValue & { key: string }, "key">;
};

db.version(1).stores({
  // Индексы только для запросов: foods — сортировка по названию + soft delete;
  // entries — день, блюдо и время создания; settings — key/value.
  foods: "id, name, deletedAt",
  entries: "id, entryDate, foodId, createdAt",
  settings: "key",
});

/** UUID для локальных записей (аналог defaultRandom() в старой схеме). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback для старых браузеров без crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Текущий момент в ISO (UTC) — формат хранения дат в локальной БД. */
export function nowIso(): string {
  return new Date().toISOString();
}
