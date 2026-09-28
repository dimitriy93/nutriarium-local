# Nutriarium AI-proxy

Отдельный минимальный AI-прокси для статического Nutriarium Local (GitHub
Pages). **Не является частью приложения** и не попадает в его сборку: ключ
Gemini живёт только в секретах воркера и никогда не появляется в браузере.

## Контракт

```
POST /
{ "text": "гречневая каша 250 г с молоком" }

→ { "ok": true,  "data": { name, calories, protein, fat, carbs } }
→ { "ok": false, "error": "человекочитаемая причина" }
```

Значения КБЖУ — на описанную порцию целиком. Прокси stateless: ничего не
сохраняет, только транслирует текст в структурированный ответ Gemini.

## Деплой (Cloudflare Workers)

```bash
cd ai-proxy
npm install
npx wrangler secret put GEMINI_API_KEY   # ключ из Google AI Studio
npx wrangler secret put GEMINI_MODEL     # например: gemini-2.0-flash
npx wrangler secret put ALLOWED_ORIGIN   # например: https://<user>.github.io
npx wrangler deploy
```

Либо через `wrangler.toml`/dashboard. `ALLOWED_ORIGIN` ограничивает CORS
происхождением GitHub Pages-приложения.

## Подключение в Nutriarium

Настройки → «AI-помощник» → вставить URL воркера (например,
`https://nutriarium-ai.<account>.workers.dev`) → «Сохранить адрес AI-proxy».

Кнопка «Рассчитать через AI» появится в форме создания блюда и будет
отправлять запросы на этот URL. Без настроенного прокси AI просто отключён —
приложение полностью работает оффлайн.

## Почему не ключ в браузере

GitHub Pages — статический хостинг: любой код, попавший в client bundle,
можно прочитать. `NEXT_PUBLIC_*`-ключи недопустимы. Ограничение Gemini-ключа
по HTTP referrer тоже не спасает: Referer подделывается любым HTTP-клиентом.
Отдельный прокси — единственный способ, при котором ключ остаётся секретом.
