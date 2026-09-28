import type { NextConfig } from "next";

/**
 * Полностью статический build для GitHub Pages:
 * - output: "export" — npm run build создаёт статические файлы в out/;
 * - trailingSlash: true — GitHub Pages отдаёт /diary/ как /diary/index.html
 *   (расширений .html без редиректа он не раздаёт);
 * - basePath — имя репозитория для project pages, задаётся на build:
 *     NEXT_PUBLIC_BASE_PATH=/nutriarium npm run build
 *   Для user/organization pages (username.github.io) basePath не нужен.
 *
 * NEXT_PUBLIC_BASE_PATH — НЕ секрет: это публичный префикс URL приложения.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
