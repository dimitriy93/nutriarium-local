"use client";

import { useEffect } from "react";
import { withBase } from "@/lib/base-path";

/**
 * Регистрация минимального service worker (public/sw.js).
 *
 * Зачем: IndexedDB — источник истины, но без SW браузер не сможет открыть
 * статические файлы приложения без сети (первый запуск PWA оффлайн = ошибка).
 * SW кэширует оболочку приложения и статику, чтобы после установки PWA
 * приложение запускалось и работало оффлайн; данные при этом живут в
 * IndexedDB и кэшированию SW не подлежат.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      return; // в dev SW не нужен и мешает hot reload
    }
    navigator.serviceWorker.register(withBase("/sw.js")).catch((error) => {
      console.error("[sw] registration failed:", error);
    });
  }, []);

  return null;
}
