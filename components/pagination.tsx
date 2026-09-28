/**
 * Компактная мобильная пагинация в стиле «◀ 1/5 ▶».
 * Используется внизу списка на /foods и в Дневнике. Скрывается, когда всё
 * содержимое помещается на одну страницу.
 */
export default function Pagination({
  page,
  pageCount,
  onPage,
  label,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;

  const arrowClass =
    "glass-control flex size-9 items-center justify-center rounded-full text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:active:scale-100";

  return (
    <nav
      aria-label={label ?? "Пагинация"}
      className="flex items-center justify-center gap-3 pt-1"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Предыдущая страница"
        className={arrowClass}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m14.5 6-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-[var(--ink-secondary)]">
        {page}/{pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        aria-label="Следующая страница"
        className={arrowClass}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m9.5 6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </nav>
  );
}