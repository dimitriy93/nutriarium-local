/**
 * Nutriarium AI-proxy — минимальный Cloudflare Worker.
 *
 * Это ОТДЕЛЬНОЕ приложение, не часть статического Nutriarium: деплоится один
 * раз (см. README), ключ Gemini живёт только в его переменных окружения и
 * никогда не попадает в браузер или client bundle.
 *
 * Контракт (совпадает с форматом действий приложения):
 *   POST /  { "text": "гречневая каша 250 г с молоком" }
 *   → 200   { "ok": true,  "data": { name, calories, protein, fat, carbs } }
 *   → 200   { "ok": false, "error": "человекочитаемая причина" }
 *
 * Ответ собирается здесь через Gemini structured output (responseSchema),
 * поэтому прокси не сохраняет состояние и ничего не пишет в какие-либо БД:
 * AI только предлагает значения, решение остаётся за пользователем.
 *
 * Переменные окружения (wrangler secret put / dashboard):
 *   GEMINI_API_KEY — ключ Gemini AI Studio;
 *   GEMINI_MODEL   — например, gemini-2.0-flash;
 *   ALLOWED_ORIGIN — https://<user>.github.io (CORS; "*" разрешает всем).
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 15000;
const TEMPERATURE = 0.1;

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
};

const SYSTEM_PROMPT = `Ты — калькулятор пищевой ценности блюд.
Пользователь описывает блюдо или порцию на естественном языке (возможно, по-русски), например: «гречневая каша 250 г с молоком».
Правила:
- Оценивай КБЖУ ИМЕННО на указанную порцию целиком. Если указана масса/объём — считай для неё, а не на 100 г. Если масса не указана — возьми стандартную порцию и оцени её.
- Верни СТРОГО JSON-объект без пояснений, разметки и текста вокруг: название блюда (краткое, с порцией, на русском), калории (ккал), белки/жиры/углеводы (граммы).
- Значения — конечные неотрицательные числа.
- Если информации недостаточно, сделай разумное предположение о составе и верни числовой результат.`;

function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function fail(env, message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return fail(env, "Только POST", 405);
    }
    if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) {
      return fail(env, "AI не настроен на прокси: задайте GEMINI_API_KEY и GEMINI_MODEL", 500);
    }

    let text;
    try {
      const body = await request.json();
      text = String(body?.text ?? "").trim();
    } catch {
      return fail(env, "Ожидается JSON вида { \"text\": \"…\" }");
    }
    if (text.length < 3 || text.length > 300) {
      return fail(env, "Опишите блюдо (3–300 символов)");
    }

    const url = `${API_BASE}/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: {
            temperature: TEMPERATURE,
            responseMimeType: "application/json",
            responseSchema: kbjuResponseSchema,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return fail(env, "AI недоступен: ошибка сети или таймаут. Попробуйте ещё раз.", 502);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return fail(env, "Превышен лимит запросов к AI. Попробуйте позже.", 429);
      }
      return fail(env, `Сервис AI вернул ошибку (код ${response.status})`, 502);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return fail(env, "AI вернул ответ, который не удалось прочитать", 502);
    }

    const blockReason = payload?.promptFeedback?.blockReason;
    if (blockReason) {
      return fail(env, "Запрос отклонён фильтрами AI");
    }
    const raw = payload?.candidates?.[0]?.content?.parts?.find((p) => p.text !== undefined)?.text;
    if (typeof raw !== "string") {
      return fail(env, "AI вернул пустой ответ", 502);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return fail(env, "AI вернул не-JSON ответ", 502);
    }

    const { name, calories, protein, fat, carbs } = data ?? {};
    const finite = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
    if (typeof name !== "string" || name.length === 0 || !finite(calories) ||
        !finite(protein) || !finite(fat) || !finite(carbs)) {
      return fail(env, "AI вернул данные с некорректными значениями");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          name: String(name).slice(0, 200),
          calories: Math.min(calories, 10000),
          protein: Math.min(protein, 1000),
          fat: Math.min(fat, 1000),
          carbs: Math.min(carbs, 1000),
        },
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders(env) } },
    );
  },
};
