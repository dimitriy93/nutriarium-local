import type { Macros } from "@/lib/diary";

/**
 * Типы истории питания. Отдельный модуль (без IndexedDB), чтобы клиентские
 * компоненты могли импортировать типы без side effects.
 */

/** Итоговый КБЖУ одного дня (snapshot * quantity по всем записям дня). */
export interface DayTotals {
  /** Локальная дата пользователя YYYY-MM-DD. */
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface StatsData {
  /** Непрерывный ряд по дням: даты без записей заполнены нулями. */
  days: DayTotals[];
  goals: Macros;
}
