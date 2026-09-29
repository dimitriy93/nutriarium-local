import { db, SETTINGS_KEYS, type AiSettings, type GoalSettings, type ProfileSettings } from "@/lib/db";
import { DEFAULT_GOALS, type Macros } from "@/lib/diary";
import type { Action } from "@/lib/types";
import { aiApiKeySchema, formatZodError, profileUpdateSchema, type ProfileUpdate } from "@/lib/validation";

/**
 * Репозиторий настроек (local data layer): профиль (имя), дневные цели и
 * Google AI API Key. Заменяет profiles в Postgres: отдельной таблицы/профиля
 * нет — key/value строки в settings-store IndexedDB. Ключ AI хранится только
 * на устройстве пользователя: не попадает в экспорт, логи и на какие-либо
 * серверы приложения.
 */

/** Цели пользователя; отсутствующие/нулевые значения заменяются дефолтами. */
export async function getGoals(): Promise<Macros> {
  const saved = (await db.settings.get(SETTINGS_KEYS.goals)) as GoalSettings | undefined;
  if (!saved) return DEFAULT_GOALS;
  const val = (v: number, fallback: number) => (v > 0 ? v : fallback);
  return {
    calories: val(saved.calories, DEFAULT_GOALS.calories),
    protein: val(saved.protein, DEFAULT_GOALS.protein),
    fat: val(saved.fat, DEFAULT_GOALS.fat),
    carbs: val(saved.carbs, DEFAULT_GOALS.carbs),
  };
}

/** Сохранение целей. Возвращает применённые значения. */
export async function saveGoals(input: GoalSettings): Promise<Action<GoalSettings>> {
  try {
    await db.settings.put({ ...input, key: SETTINGS_KEYS.goals });
    return { ok: true, data: input };
  } catch (error) {
    console.error("[settings] saveGoals failed:", error);
    return { ok: false, error: "Не удалось сохранить цели" };
  }
}

/** Имя пользователя (displayName), может быть пустым. */
export async function getProfile(): Promise<ProfileSettings> {
  const saved = (await db.settings.get(SETTINGS_KEYS.profile)) as ProfileSettings | undefined;
  return saved ?? { displayName: "" };
}

/** Сохранение профиля (имя + дневные цели) — формат формы настроек. */
export async function saveProfile(input: ProfileUpdate): Promise<Action<ProfileSettings & { goals: GoalSettings }>> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  try {
    const profile: ProfileSettings & { key: string } = {
      key: SETTINGS_KEYS.profile,
      displayName: parsed.data.displayName,
    };
    const goals: GoalSettings & { key: string } = {
      key: SETTINGS_KEYS.goals,
      calories: parsed.data.calorieGoal,
      protein: parsed.data.proteinGoal,
      fat: parsed.data.fatGoal,
      carbs: parsed.data.carbsGoal,
    };
    await db.settings.bulkPut([profile, goals]);
    return {
      ok: true,
      data: { displayName: profile.displayName, goals },
    };
  } catch (error) {
    console.error("[settings] saveProfile failed:", error);
    return { ok: false, error: "Не удалось сохранить настройки" };
  }
}

/** Google AI API Key; null — AI не настроен (приложение работает без него). */
export async function getAiApiKey(): Promise<string | null> {
  const saved = (await db.settings.get(SETTINGS_KEYS.ai)) as AiSettings | undefined;
  return saved?.apiKey ? saved.apiKey : null;
}

/** Сохранение Google AI API Key (только локально, в settings-store). */
export async function saveAiApiKey(apiKey: string): Promise<Action<string>> {
  const parsed = aiApiKeySchema.safeParse(apiKey);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  try {
    const value: AiSettings & { key: string } = {
      key: SETTINGS_KEYS.ai,
      apiKey: parsed.data,
    };
    await db.settings.put(value);
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("[settings] saveAiApiKey failed:", error);
    return { ok: false, error: "Не удалось сохранить API-ключ" };
  }
}

/** Удаление сохранённого ключа (AI отключается, всё остальное работает). */
export async function clearAiApiKey(): Promise<Action<true>> {
  try {
    await db.settings.delete(SETTINGS_KEYS.ai);
    return { ok: true, data: true };
  } catch (error) {
    console.error("[settings] clearAiApiKey failed:", error);
    return { ok: false, error: "Не удалось удалить API-ключ" };
  }
}
