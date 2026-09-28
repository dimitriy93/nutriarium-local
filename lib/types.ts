import type { Macros } from "@/lib/diary";

/**
 * Общие типы-контракты local data layer. Действие «результат операции»
 * повторяет прежний дизайн server actions ({ ok, data | error }) — компоненты
 * почти не меняются при переходе на локальный слой.
 */

export type Action<T> = { ok: true; data: T } | { ok: false; error: string };

export type { Macros };
