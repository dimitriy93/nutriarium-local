/**
 * Публичный префикс URL приложения на GitHub Pages (project pages).
 * Задаётся на build через NEXT_PUBLIC_BASE_PATH; это НЕ секрет — просто часть
 * публичного адреса сайта. В dev/на user pages — пустая строка.
 */
export function withBase(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}
