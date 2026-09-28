/**
 * Общие примитивы дневника: тип макросов и значения по умолчанию.
 * Модуль чистый (без IndexedDB) — его импортируют и репозитории, и клиент.
 */

export interface Macros {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** Значения по умолчанию, пока пользователь не задал цели в настройках. */
export const DEFAULT_GOALS: Macros = {
  calories: 2000,
  protein: 120,
  fat: 70,
  carbs: 250,
};

/** Итоговое КБЖУ записи дневника = snapshot * quantity. */
export function entryMacros(entry: {
  caloriesSnapshot: number;
  proteinSnapshot: number;
  fatSnapshot: number;
  carbsSnapshot: number;
  quantity: number;
}): Macros {
  return {
    calories: entry.caloriesSnapshot * entry.quantity,
    protein: entry.proteinSnapshot * entry.quantity,
    fat: entry.fatSnapshot * entry.quantity,
    carbs: entry.carbsSnapshot * entry.quantity,
  };
}

/** Сумма КБЖУ по массиву записей (пустой список — нули). */
export function sumMacros(
  entries: Parameters<typeof entryMacros>[0][],
): Macros {
  return entries.reduce<Macros>(
    (acc, e) => {
      const m = entryMacros(e);
      return {
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        fat: acc.fat + m.fat,
        carbs: acc.carbs + m.carbs,
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
}
