# Nutriarium Local 2.0

Локальная (local-first) версия Nutriarium: питание, дневник, история — без
сервера, базы данных и авторизации. Все данные хранятся в браузере
(IndexedDB), приложение разворачивается как статический сайт на GitHub Pages.

Единственная сетевая функция — AI-помощник определения КБЖУ, который
вызывается только по явному действию пользователя и никогда не пишет в базу
сам (предложение → проверка → подтверждение → IndexedDB).

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
lib/ai/estimate.ts     клиент AI: запрос на внешний прокси + валидация
lib/export/            NutriariumExport (JSON) + clipboard
app/                   страницы: /diary /history /foods /settings
ai-proxy/              отдельный Cloudflare Worker для AI (ключ живёт тут)
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

Статическое приложение не может безопасно хранить API-ключ: всё, что попало
в client bundle, читаемо любым пользователем. Поэтому AI вынесен на
отдельный минимальный прокси — см. [ai-proxy/README.md](ai-proxy/README.md).
В настройках приложения задаётся только адрес прокси; без него AI отключён,
а всё остальное работает оффлайн.

## Экспорт данных (Silentium)

Настройки → «Экспорт данных» → JSON в буфер обмена (schemaVersion 1:
entries, foods, goals). Контракт — `lib/export/export.ts`.

## Reference

`/nutriarium-base` — эталон прежней Supabase-версии, используется только как
источник UI и логики; новая версия его не импортирует.
