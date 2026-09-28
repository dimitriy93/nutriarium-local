import { buildExport } from "@/lib/export/export";

/**
 * Копирование JSON-экспорта в буфер обмена (navigator.clipboard).
 *
 * Обрабатываются: успех, отсутствие Clipboard API (старые браузеры /
 * http-контекст) и ошибки записи (разрешение, отказ). Fallback — временный
 * textarea + execCommand('copy'): работает без Clipboard API в большинстве
 * браузеров. Пользователь всегда получает человекочитаемый результат.
 */

export type CopyResult = { ok: true } | { ok: false; error: string };

async function copyViaClipboardApi(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Отказ в разрешении или ошибка записи — пробуем fallback ниже.
    return false;
  }
}

/** Fallback для контекстов без Clipboard API (не https, старые WebView). */
function copyViaExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

/** Собирает экспорт из IndexedDB и копирует его JSON в буфер обмена. */
export async function copyExportToClipboard(): Promise<CopyResult> {
  let json: string;
  try {
    json = JSON.stringify(await buildExport(), null, 2);
  } catch (error) {
    console.error("[export] build failed:", error);
    return { ok: false, error: "Не удалось собрать данные для экспорта" };
  }

  if (await copyViaClipboardApi(json)) {
    return { ok: true };
  }
  if (copyViaExecCommand(json)) {
    return { ok: true };
  }
  return {
    ok: false,
    error: "Браузер не разрешил копирование. Откройте приложение по https и повторите.",
  };
}
