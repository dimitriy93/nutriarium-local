import type { MetadataRoute } from "next";
import { withBase } from "@/lib/base-path";

// Требование output: "export" для route handlers (метаданные статические).
export const dynamic = "force-static";

/**
 * PWA-манифест (Next.js App Router генерирует /manifest.webmanifest).
 * theme_color / background_color — из текущей палитры приложения (globals.css).
 * Пути иконок учитывают basePath GitHub Pages.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nutriarium",
    short_name: "Nutriarium",
    description: "Локальный учёт питания",
    lang: "ru",
    // Пусковая страница "/" рендерит документ и переходит на /diary на клиенте:
    // HTTP-редирект самого первого документа даёт белый экран при launch
    // установленного PWA на iOS (WebKit).
    start_url: withBase("/"),
    scope: withBase("/"),
    display: "standalone",
    orientation: "portrait",
    theme_color: "#f4f6f8",
    background_color: "#f4f6f8",
    icons: [
      { src: withBase("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: withBase("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
