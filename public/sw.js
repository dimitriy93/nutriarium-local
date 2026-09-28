/**
 * Минимальный service worker Nutriarium Local.
 *
 * Только оболочка: IndexedDB уже является источником истины, синхронизации
 * и offline-очереди мутаций не нужны. Стратегия:
 * - /_next/static/* (immutable-ассеты сборки) — cache-first;
 * - навигации и прочие файлы приложения — stale-while-revalidate: отдаём из
 *   кэша мгновенно, обновляем кэш в фоне; при отсутствии сети работает кэш.
 *
 * Учитывает basePath GitHub Pages: scope сворачивается до префикса приложения.
 */

const CACHE_NAME = "nutriarium-static-v1";

function appPrefix() {
  // scope: https://user.github.io/repo/ → префикс "/repo/".
  const scope = new URL(self.registration.scope);
  return scope.pathname;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // AI-proxy и прочие внешние — мимо кэша

  const prefix = appPrefix();
  if (!url.pathname.startsWith(prefix)) return;

  // Навигации (переходы между страницами PWA): SWR + fallback на start page.
  if (request.mode === "navigate") {
    event.respondWith(swr(request, `${prefix}index.html`));
    return;
  }

  // Immutable-ассеты сборки: cache-first, они меняются только с новым билдом.
  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Остальное (иконки, manifest, branding): stale-while-revalidate.
  event.respondWith(swr(request, null));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function swr(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Пока идёт сеть, ждём кэш ограниченно: мгновенная отдача важнее свежести.
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  if (fallbackUrl) {
    const fallback = await cache.match(fallbackUrl);
    if (fallback) return fallback;
  }
  return new Response("", { status: 504, statusText: "Offline" });
}
