import {
  aiEstimateInputSchema,
  foodInputSchema,
  formatZodError,
  sanityCheckAiFood,
  type FoodInput,
} from "@/lib/validation";
import { getAiSettings } from "@/lib/repositories/settings";
import type { Action } from "@/lib/types";

/**
 * AI-помощник определения КБЖУ — единственная сетевая функция local-first
 * Nutriarium. Вызывается ТОЛЬКО по явному действию пользователя; результат —
 * предложение: он никогда не сохраняется автоматически, сохранение делает
 * пользователь после проверки (обычный createFood).
 *
 * Архитектура (вариант B): секретный API-ключ Gemini НЕ попадает в браузер.
 * Приложение отправляет текст блюда на отдельный минимальный AI-proxy
 * (см. ai-proxy/ — Cloudflare Worker, ключ в его переменных окружения), который
 * обращается к Gemini и возвращает уже готовый структурированный результат.
 * В client bundle попадает только URL прокси — без ключей.
 *
 * Ответ proxy дополнительно валидируется на клиенте (zod + sanity check):
 * proxy может быть любым, поэтому структурированному ответу не доверяем.
 */

const TIMEOUT_MS = 15_000;

/** Ошибка интеграции с AI. `message` — безопасная формулировка для UI. */
export class AiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiError";
  }
}

/** Валидация структурированного результата: zod (границы) → sanity checks. */
export function parseAiSuggestion(data: unknown): FoodInput {
  const parsed = foodInputSchema.safeParse(data);
  if (!parsed.success) {
    throw new AiError("AI вернул данные с некорректными значениями");
  }
  const sanityError = sanityCheckAiFood(parsed.data);
  if (sanityError) {
    throw new AiError(sanityError);
  }
  return parsed.data;
}

/**
 * Расчёт КБЖУ по свободному тексту («гречневая каша 250 г с молоком»).
 * Бросает AiError с безопасным для показа сообщением.
 */
export async function estimateFood(userText: string): Promise<Action<FoodInput>> {
  const text = aiEstimateInputSchema.safeParse(userText);
  if (!text.success) {
    return { ok: false, error: formatZodError(text.error) };
  }

  let proxyUrl: string | null = null;
  try {
    proxyUrl = (await getAiSettings())?.proxyUrl ?? null;
  } catch {
    proxyUrl = null;
  }
  if (!proxyUrl) {
    return {
      ok: false,
      error:
        "AI не настроен: укажите адрес AI-proxy в настройках приложения.",
    };
  }

  let response: Response;
  try {
    response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.data }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, error: "AI недоступен: таймаут. Попробуйте ещё раз." };
    }
    console.error("[ai] network failure:", error);
    // Оффлайн / DNS / CORS — для пользователя это прежде всего «нет интернета».
    return {
      ok: false,
      error:
        "Для AI-запроса требуется интернет. Приложение продолжает работать оффлайн, попробуйте позже.",
    };
  }

  if (!response.ok) {
    if (response.status === 429) {
      return { ok: false, error: "Превышен лимит запросов к AI. Попробуйте позже." };
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { ok: false, error: "AI-proxy отклонил запрос (проверьте конфигурацию прокси)." };
    }
    return { ok: false, error: `Сервис AI вернул ошибку (код ${response.status})` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "AI вернул ответ, который не удалось прочитать" };
  }

  // Контракт proxy совпадает с форматом действий приложения: { ok, data | error }.
  const envelope = payload as { ok?: unknown; data?: unknown; error?: unknown };
  if (envelope && envelope.ok === false && typeof envelope.error === "string") {
    return { ok: false, error: envelope.error };
  }
  if (!envelope || envelope.ok !== true) {
    return { ok: false, error: "AI вернул ответ в неожиданном формате" };
  }

  try {
    return { ok: true, data: parseAiSuggestion(envelope.data) };
  } catch (error) {
    if (error instanceof AiError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: "AI не смог рассчитать блюдо. Попробуйте ещё раз или введите КБЖУ вручную.",
    };
  }
}
