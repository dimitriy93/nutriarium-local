import { z } from "zod";

/**
 * Zod-схемы входных данных. В local-first версии валидация выполняется на
 * клиенте перед записью в IndexedDB (репозитории — единственная точка входа
 * данных) и при разборе AI-ответа (structured output всё равно не доверяется).
 */

/** КБЖУ на одну порцию. Границы синхронизированы с sanity-check для AI. */
export const foodInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите название блюда")
    .max(200, "Название слишком длинное (максимум 200 символов)"),
  calories: z
    .number({ message: "Калории должны быть числом" })
    .min(0, "Калории не могут быть отрицательными")
    .max(10000, "Слишком большое значение калорий"),
  protein: z
    .number({ message: "Белки должны быть числом" })
    .min(0, "Белки не могут быть отрицательными")
    .max(1000, "Слишком большое значение белков"),
  fat: z
    .number({ message: "Жиры должны быть числом" })
    .min(0, "Жиры не могут быть отрицательными")
    .max(1000, "Слишком большое значение жиров"),
  carbs: z
    .number({ message: "Углеводы должны быть числом" })
    .min(0, "Углеводы не могут быть отрицательными")
    .max(1000, "Слишком большое значение углеводов"),
});

export type FoodInput = z.infer<typeof foodInputSchema>;

/** Частичное обновление: хотя бы одно поле должно присутствовать. */
export const foodUpdateSchema = z
  .object({
    name: foodInputSchema.shape.name.optional(),
    calories: foodInputSchema.shape.calories.optional(),
    protein: foodInputSchema.shape.protein.optional(),
    fat: foodInputSchema.shape.fat.optional(),
    carbs: foodInputSchema.shape.carbs.optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "Нет данных для обновления" },
  );

export type FoodUpdate = z.infer<typeof foodUpdateSchema>;

export const foodSearchSchema = z
  .string()
  .trim()
  .max(200, "Поисковый запрос слишком длинный");

export const uuidSchema = z.string().uuid("Некорректный идентификатор");

/**
 * Настройки: имя и дневные цели КБЖУ. Цели — строго положительные числа
 * (0 и отрицательные запрещены): не заданную цель пользователь просто
 * не сохраняет, а отсутствующие значения остаются fallback-логике дневника.
 */
export const profileUpdateSchema = z.object({
  displayName: z
    .string({ message: "Укажите имя" })
    .trim()
    .min(1, "Укажите имя")
    .max(60, "Имя слишком длинное (максимум 60 символов)"),
  calorieGoal: z
    .number({ message: "Калории должны быть числом" })
    .positive("Калории должны быть больше нуля")
    .max(20000, "Слишком большое значение калорий"),
  proteinGoal: z
    .number({ message: "Белки должны быть числом" })
    .positive("Белки должны быть больше нуля")
    .max(1000, "Слишком большое значение белков"),
  fatGoal: z
    .number({ message: "Жиры должны быть числом" })
    .positive("Жиры должны быть больше нуля")
    .max(1000, "Слишком большое значение жиров"),
  carbsGoal: z
    .number({ message: "Углеводы должны быть числом" })
    .positive("Углеводы должны быть больше нуля")
    .max(1000, "Слишком большое значение углеводов"),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

/**
 * Google AI API Key: непустая строка без переносов. Ключ хранится только
 * локально (IndexedDB) и никогда не попадает в экспорт и логи.
 */
export const aiApiKeySchema = z
  .string()
  .trim()
  .min(1, "Вставьте Google AI API Key")
  .refine((v) => !/[\r\n]/.test(v), "Ключ не должен содержать переносов строк")
  .max(200, "Слишком длинное значение ключа");

export type AiApiKeyInput = z.infer<typeof aiApiKeySchema>;

/** Текст пользователя для расчёта КБЖУ через AI. */
export const aiEstimateInputSchema = z
  .string()
  .trim()
  .min(3, "Опишите блюдо (минимум 3 символа)")
  .max(300, "Описание слишком длинное (максимум 300 символов)");

/**
 * Дополнительные проверки физической правдоподобности ответа AI поверх zod.
 * AI может вернуть технически валидный JSON с абсурдными значениями
 * (например, калории в 10 раз выше, чем даёт состав макроэлементов).
 *
 * Возвращает null, если всё в порядке, иначе человекочитаемую причину отказа.
 */
export function sanityCheckAiFood(food: FoodInput): string | null {
  // NaN/Infinity zod отсеивает сам (не число / превышение max),
  // здесь проверяем энергетическую согласованность:
  // calories ≈ protein*4 + carbs*4 + fat*9 (допуск на клетчатку, округления, алкоголь и т.п.)
  const expected = food.protein * 4 + food.carbs * 4 + food.fat * 9;
  const tolerance = Math.max(150, expected * 0.35);
  if (Math.abs(food.calories - expected) > tolerance) {
    return `Калории (${food.calories}) не согласуются с составом макроэлементов (ожидалось ~${Math.round(expected)}). Ответ AI отклонён.`;
  }
  return null;
}

/**
 * Форматирует первую ошибку zod в человекочитаемое сообщение.
 * Больше подходит для UI, чем вывод всех issues.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Некорректные данные";
}
