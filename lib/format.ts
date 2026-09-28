/**
 * Форматирование entry_date (YYYY-MM-DD) на русском без Date-парсинга:
 * строка date — локальная дата пользователя, а `new Date("2026-09-11")`
 * парсится как UTC и может сдвинуться на день в локальном часовом поясе.
 */
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const;

export function formatDateRu(date: string): string {
  const [, m, d] = date.split("-");
  const month = MONTHS_GENITIVE[Number(m) - 1];
  return month ? `${Number(d)} ${month}` : date;
}