# Nutriarium Local 2.0

Локальная (local-first) версия Nutriarium: питание, дневник, история — без
сервера, базы данных и авторизации. Все данные хранятся в браузере
(IndexedDB), приложение разворачивается как статический сайт на GitHub Pages.

Единственная сетевая функция — AI-помощник определения КБЖУ (прямой запрос к
Google Gemini с ключом пользователя), который вызывается только по явному
действию пользователя и никогда не пишет в базу сам (предложение → проверка →
подтверждение → IndexedDB).

## Стек

- Next.js 15 (App Router, `output: "export"` — полностью статический build)
- React 19, TypeScript, Tailwind CSS 4
- IndexedDB через Dexie (единственный источник истины)
- PWA (manifest + минимальный service worker для офлайн-запуска)

## Архитектура

```
components/            UI (перенесён из /nutriarium-base)
lib/db/                Dexie-схема: foods, entries, settings
lib/repositories/      foods, diary (entries), history, settings
lib/ai/estimate.ts     клиент AI: прямой запрос к Gemini + валидация
lib/export/            NutritionExport (итоги дня, JSON) + clipboard
app/                   страницы: /diary /history /foods /settings
```

Компоненты UI не обращаются к IndexedDB напрямую — только через
`lib/repositories`. Snapshot-модель дневника сохранена: запись хранит
собственные КБЖУ на момент добавления, редактирование блюда историю не меняет.

## Разработка

```bash
npm install
npm run dev        # http://localhost:3000
```

## Проверки

```bash
npm run typecheck
npm run lint
npm test
npm run build      # статический build в out/
```

## Деплой на GitHub Pages

Project pages (репозиторий `nutriarium` на `user.github.io/nutriarium`):

```bash
NEXT_PUBLIC_BASE_PATH=/nutriarium npm run build
# опубликовать содержимое out/ в ветку gh-pages
```

`NEXT_PUBLIC_BASE_PATH` — публичный префикс URL (не секрет). Для
`user.github.io` репозитория переменная не нужна.

GitHub Actions (набросок):

```yaml
- run: npm ci
- run: NEXT_PUBLIC_BASE_PATH=/${{ github.event.repository.name }} npm run build
- uses: actions/upload-pages-artifact@v3
  with:
    path: out
```

## AI-помощник

Приложение обращается к Google Gemini напрямую из браузера, без промежуточного
прокси или сервера. Пользователь вставляет свой Google AI API Key в настройках
(«AI-помощник»); ключ хранится только на устройстве (IndexedDB, settings-store),
не попадает в экспорт и не отправляется ни на какие серверы Nutriarium.

Это осознанное решение для локального пользовательского приложения: серверной
инфраструктуры нет, поэтому ключ не является секретом внутри неё. Ответ Gemini
не доверяется: structured output + zod-валидация + sanity-check на клиенте.
Без ключа AI-функция просто недоступна — всё остальное работает оффлайн.

## Экспорт КБЖУ (Silentium)

Дневник → «Копировать КБЖУ» у дневных итогов: JSON текущего дня в буфер
обмена (schemaVersion 1: schemaVersion, source, date, nutrition — только
суммарное КБЖУ, без продуктов, целей и настроек). Контракт —
`lib/export/export.ts`.

## Reference

`/nutriarium-base` — эталон прежней Supabase-версии, используется только как
источник UI и логики; новая версия его не импортирует.
