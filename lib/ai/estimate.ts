import {
  aiEstimateInputSchema,
  foodInputSchema,
  formatZodError,
  sanityCheckAiFood,
  type FoodInput,
} from "@/lib/validation";
import { getAiApiKey } from "@/lib/repositories/settings";
import type { Action } from "@/lib/types";

/**
 * AI-помощник определения КБЖУ — единственная сетевая функция local-first
 * Nutriarium. Вызывается ТОЛЬКО по явному действию пользователя; результат —
 * предложение: он никогда не сохраняется автоматически, сохранение делает
 * пользователь после проверки (обычный createFood).
 *
 * Архитектура: приложение обращается к Google Gemini НАПРЯМУЮ из браузера,
 * без промежуточного прокси/сервера. Google AI API Key пользователь вставляет
 * сам в настройках; ключ хранится только локально (IndexedDB, settings-store)
 * и уходит только в Google. Это осознанное решение для локального приложения:
 * ключ не является секретом серверной инфраструктуры, потому что её нет.
 *
 * Ответ Gemini дополнительно валидируется на клиенте (zod + sanity check):
 * структурированному ответу модели не доверяем.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 15_000;
const TEMPERATURE = 0.1;
const GEMINI_MODEL = "gemini-2.0-flash";

/** Подмножество OpenAPI Schema, поддерживаемое Gemini responseSchema. */
const kbjuResponseSchema = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    calories: { type: "NUMBER" },
    protein: { type: "NUMBER" },
    fat: { type: "NUMBER" },
    carbs: { type: "NUMBER" },
  },
  required: ["name", "calories", "protein", "fat", "carbs"],
} as const;

const SYSTEM_PROMPT = `Ты — калькулятор пищевой ценности блюд.
Пользователь описывает блюдо или порцию на естественном языке (возможно, по-русски), например: «гречневая каша 250 г с молоком».
Правила:
- Оценивай КБЖУ ИМЕННО на указанную порцию целиком. Если указана масса/объём — считай для неё, а не на 100 г. Если масса не указана — возьми стандартную порцию и оцени её.
- Верни СТРОГО JSON-объект без пояснений, разметки и текста вокруг: название блюда (краткое, с порцией, на русском), калории (ккал), белки/жиры/углеводы (граммы).
- Значения — конечные неотрицательные числа.
- Если информации недостаточно, сделай разумное предположение о составе и верни числовой результат.`;

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
 * Разбор сырого JSON-ответа Gemini REST до объекта предложения.
 * Выделено отдельно (pure-функция), чтобы можно было проверять malformed
 * ответы в тестах без сети.
 */
export function extractSuggestion(payload: unknown): FoodInput {
  if (typeof payload !== "object" || payload === null) {
    throw new AiError("AI вернул ответ в неожиданном формате");
  }
  const feedback = (payload as { promptFeedback?: { blockReason?: unknown } })
    .promptFeedback;
  if (feedback && typeof feedback.blockReason === "string") {
    throw new AiError("Запрос отклонён фильтрами AI");
  }
  const parts = (payload as {
    candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  }).candidates;
  const text = parts?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text;
  if (typeof text !== "string") {
    throw new AiError("AI вернул пустой ответ");
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError("AI вернул не-JSON ответ");
  }
  return parseAiSuggestion(json);
}

/**
 * Расчёт КБЖУ по свободному тексту («гречневая каша 250 г с молоком»).
 * Прямой запрос к Google Gemini API из браузера с ключом пользователя.
 * Бросает/возвращает AiError с безопасным для показа сообщением; сам ключ
 * ни в сообщения, ни в консоль не попадает.
 */
export async function estimateFood(userText: string): Promise<Action<FoodInput>> {
  const text = aiEstimateInputSchema.safeParse(userText);
  if (!text.success) {
    return { ok: false, error: formatZodError(text.error) };
  }

  const apiKey = await getAiApiKey().catch(() => null);
  if (!apiKey) {
    return {
      ok: false,
      error:
        "AI не настроен: добавьте Google AI API Key в настройках приложения.",
    };
  }

  const url = `${API_BASE}/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: text.data }] }],
        generationConfig: {
          temperature: TEMPERATURE,
          responseMimeType: "application/json",
          responseSchema: kbjuResponseSchema,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, error: "AI недоступен: таймаут. Попробуйте ещё раз." };
    }
    console.error("[ai] network failure:", error);
    // Оффлайн / DNS — для пользователя это прежде всего «нет интернета».
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
      return {
        ok: false,
        error: "Google отклонил запрос (проверьте Google AI API Key в настройках).",
      };
    }
    return { ok: false, error: `Сервис AI вернул ошибку (код ${response.status})` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "AI вернул ответ, который не удалось прочитать" };
  }

  try {
    return { ok: true, data: extractSuggestion(payload) };
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
