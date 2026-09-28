/**
 * Расчёт дневных целей КБЖУ для Goal Wizard (этап 8.5).
 * Простая понятная модель: Mifflin-St Jeor × коэффициент активности,
 * поправка на цель, макросы от остатка калорий. Чистая функция — без БД
 * и без "use server", используется клиентским компонентом визарда.
 */

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high";
export type GoalType = "loss" | "maintain" | "gain";

export interface WizardInput {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: GoalType;
  /** Необязательные ограничения (шаг «Особые предпочтения»). */
  minProteinG?: number | null;
  maxFatG?: number | null;
  fixedCalories?: number | null;
}

export interface CalculatedGoals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** Коэффициенты активности: от сидячего до высокой активности. */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

/** Поправка калорий на цель: дефицит/профицит в ккал. */
const GOAL_ADJUSTMENT: Record<GoalType, number> = {
  loss: -500,
  maintain: 0,
  gain: 300,
};

const MIN_CALORIES = 1200;

/** Округление до 5 — спокойные «человеческие» значения вместо точных до единицы. */
function round5(value: number): number {
  return Math.max(0, Math.round(value / 5) * 5);
}

/**
 * Mifflin-St Jeor:
 *   мужчины: 10·вес + 6.25·рост − 5·возраст + 5
 *   женщины: 10·вес + 6.25·рост − 5·возраст − 161
 */
export function calcBmr(input: Pick<WizardInput, "gender" | "age" | "heightCm" | "weightKg">): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.gender === "male" ? base + 5 : base - 161;
}

export function calculateGoals(input: WizardInput): CalculatedGoals {
  const tdee = calcBmr(input) * ACTIVITY_FACTORS[input.activity];

  const calories = Math.max(
    MIN_CALORIES,
    input.fixedCalories && input.fixedCalories > 0
      ? input.fixedCalories
      : tdee + GOAL_ADJUSTMENT[input.goal],
  );

  // Белок: ручной минимум, если задан, иначе ориентир 1.6 г/кг веса
  // (умеренно-спортивная норма, безопасная по умолчанию).
  const protein = Math.max(
    1,
    input.minProteinG && input.minProteinG > 0
      ? input.minProteinG
      : input.weightKg * 1.6,
  );

  // Жиры: ручной максимум, если задан, иначе 30% калорий.
  const fat = input.maxFatG && input.maxFatG > 0
    ? Math.min(input.maxFatG, calories * 0.45 / 9)
    : (calories * 0.3) / 9;

  // Углеводы — остаток калорий (4 ккал/г), не ниже нуля.
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);

  return {
    calories: round5(calories),
    protein: round5(protein),
    fat: round5(fat),
    carbs: round5(carbs),
  };
}