"use client";

import { useEffect, useState } from "react";
import { listFoods, listRecentFoods, searchFoods } from "@/lib/repositories/foods";
import {
  createEntry,
  dailyTotals,
  deleteEntry,
  listEntriesForDay,
} from "@/lib/repositories/diary";
import { getGoals, getProfile } from "@/lib/repositories/settings";
import EmptyIllustration from "@/components/empty-illustration";
import Pagination from "@/components/pagination";
import { copyNutritionToClipboard } from "@/lib/export/clipboard";
import { entryMacros, DEFAULT_GOALS, type Macros } from "@/lib/diary";
import type { Food, FoodEntry } from "@/lib/db";

/** Размер страницы списка записей дневника. */
const PAGE_SIZE = 12;

/** Максимум подсказок в поиске добавления блюда. */
const SUGGESTION_LIMIT = 6;

/**
 * Клиентская часть дневника: итоги дня, список записей, модальное окно
 * добавления блюда (поиск + порции) и удаление. Локальная дата вычисляется на
 * клиенте (entry_date — локальная дата пользователя по архитектуре), поэтому
 * первая загрузка выполняется из useEffect. Все данные читаются и пишутся
 * напрямую в IndexedDB через lib/repositories — без сети.
 */

const macroMeta: { key: Exclude<keyof Macros, "calories">; label: string; color: string }[] = [
  { key: "protein", label: "Белки", color: "#5b9bf0" },
  { key: "fat", label: "Жиры", color: "#f0b35b" },
  { key: "carbs", label: "Углеводы", color: "#8f6bf0" },
];

export default function DiaryClient({ hasEmptyIllustration }: { hasEmptyIllustration: boolean }) {
  const [userName, setUserName] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [totals, setTotals] = useState<Macros>({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  const [goals, setGoals] = useState<Macros>(DEFAULT_GOALS);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dateLabel, setDateLabel] = useState("");
  const [page, setPage] = useState(1);
  // Экспорт текущего КБЖУ (Silentium): итоги дня → clipboard JSON.
  const [exportState, setExportState] = useState<{ ok: boolean; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async (d: string) => {
    const [entriesResult, totalsResult] = await Promise.all([
      listEntriesForDay(d),
      dailyTotals(d),
    ]);
    if (!entriesResult.ok) {
      setError(entriesResult.error);
      return;
    }
    if (!totalsResult.ok) {
      setError(totalsResult.error);
      return;
    }
    setEntries(entriesResult.data);
    setTotals(totalsResult.data);
    setGoals(await getGoals());
    setError(null);
  };

  // Локальная дата известна только на клиенте — грузим после монтирования.
  useEffect(() => {
    const d = todayIso();
    setDate(d);
    setDateLabel(
      new Date().toLocaleDateString("ru", { day: "numeric", month: "long", weekday: "long" }),
    );
    getProfile().then((p) => setUserName(p.displayName));
    load(d);
  }, []);

  const handleCreated = async (entry: FoodEntry) => {
    if (!date) return;
    setEntries((prev) => [entry, ...prev]);
    // Пересчитываем итоги из локальной БД — snapshot*quantity уже учтён в записи.
    const totalsResult = await dailyTotals(date);
    if (totalsResult.ok) setTotals(totalsResult.data);
  };

  const handleDeleted = async (id: string) => {
    if (!date) return;
    const result = await deleteEntry(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    // Остаёмся на текущей странице; если она опустела — на предыдущую.
    setPage((p) => {
      const remaining = entries.filter((e) => e.id !== id).length;
      return Math.max(1, Math.min(p, Math.ceil(remaining / PAGE_SIZE)));
    });
    const totalsResult = await dailyTotals(date);
    if (totalsResult.ok) setTotals(totalsResult.data);
  };

  const goal = goals;
  const kcalPct = Math.min(100, goal.calories > 0 ? (totals.calories / goal.calories) * 100 : 0);

  const handleCopyNutrition = async () => {
    if (!date || exporting) return;
    setExporting(true);
    setExportState(null);
    const result = await copyNutritionToClipboard(date);
    setExporting(false);
    setExportState(
      result.ok
        ? { ok: true, message: "КБЖУ за сегодня скопировано" }
        : { ok: false, message: result.error },
    );
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] space-y-5 px-5 pt-[max(env(safe-area-inset-top),48px)] pb-16">
      {/* Шапка */}
      <header className="space-y-0.5 px-1">
        {userName && (
          <p className="text-sm font-medium text-[var(--ink-secondary)]">{userName}</p>
        )}
        <h1 className="text-[28px] font-bold tracking-tight">
          {date ? "Сегодня" : "Загрузка…"}
        </h1>
        {dateLabel && (
          <p className="text-sm font-medium text-[var(--ink-secondary)]">{dateLabel}</p>
        )}
      </header>

      {error && (
        <p className="glass-card px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {/* Карточка итогов */}
      <section className="glass-card space-y-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--ink-secondary)]">Калории</p>
            <p className="mt-1.5 text-[44px] leading-none font-bold tracking-tight">
              {Math.round(totals.calories)}
              <span className="text-lg font-semibold text-[var(--ink-secondary)]">
                {" "}/ {goal.calories}
              </span>
            </p>
            <p className="mt-2 text-xs font-medium text-[var(--ink-secondary)]">
              {Math.max(0, Math.round(goal.calories - totals.calories))} ккал до цели
            </p>
          </div>
          <span
            className="glass-badge text-[#1d8a60]"
            style={{ background: "var(--accent-soft)" }}
          >
            {Math.round(kcalPct)}%
          </span>
        </div>
        <div className="progress-track h-2.5">
          <div
            className="progress-fill"
            style={{ width: `${kcalPct}%`, background: "linear-gradient(90deg,#2fbf85,#34c78f)" }}
          />
        </div>

        <div className="space-y-3 pt-1">
          {macroMeta.map(({ key, label, color }) => {
            const pct = Math.min(100, goal[key] > 0 ? (totals[key] / goal[key]) * 100 : 0);
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      aria-hidden="true"
                      className="inline-block size-2 rounded-full"
                      style={{ background: color }}
                    />
                    {label}
                  </span>
                  <span className="text-[var(--ink-secondary)]">
                    <span className="font-semibold text-[var(--ink)]">{Math.round(totals[key])}</span>
                    {" "}/ {goal[key]}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Экспорт текущего КБЖУ дня (Silentium) — только итоги, без продуктов */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleCopyNutrition}
            disabled={!date || exporting}
            className="glass-control flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
              <rect x="7" y="2.5" width="9" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4.5 6.5A2 2 0 0 0 4 7.5v8a2 2 0 0 0 2 2h6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {exporting ? "Копируем…" : "Копировать КБЖУ"}
          </button>
          {exportState && (
            <p className={`text-xs ${exportState.ok ? "text-[#1d8a60]" : "text-red-600"}`}>
              {exportState.message}
            </p>
          )}
        </div>
      </section>

      {/* Добавить блюдо — сразу под карточкой итогов, чтобы не перекрывалась клавиатурой */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-[var(--accent)] py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)] transition active:scale-[0.98]"
      >
        <span className="text-xl leading-none">+</span> Добавить блюдо
      </button>

      {/* Записи за день */}
      <section className="space-y-3">
        <h2 className="section-title px-1">
          Записи ({entries.length})
        </h2>

        {entries.length === 0 && !error && (
          <div className="glass-card px-4 py-3">
            {date === null ? (
              <p className="text-center text-sm text-[var(--ink-secondary)]">Загрузка…</p>
            ) : (
              <EmptyIllustration
                hasImage={hasEmptyIllustration}
                caption="Сегодня ещё нет записей"
              />
            )}
          </div>
        )}

        <ul className="space-y-3">
          {entries
            .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
            .map((entry) => {
            const m = entryMacros(entry);
            return (
              <li key={entry.id} className="glass-card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold">{entry.nameSnapshot}</p>
                    <p className="shrink-0 text-base font-bold tracking-tight">
                      {Math.round(m.calories)}
                      <span className="ml-1 text-xs font-medium text-[var(--ink-secondary)]">
                        ккал
                      </span>
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                    {entry.quantity === 1 ? "1 порция" : `${entry.quantity} порции`} ·{" "}
                    {new Date(entry.createdAt).toLocaleTimeString("ru", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--ink-secondary)]">
                    <span>Б {m.protein.toFixed(1)}</span>
                    <span>Ж {m.fat.toFixed(1)}</span>
                    <span>У {m.carbs.toFixed(1)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Удалить «${entry.nameSnapshot}»`}
                  onClick={() => handleDeleted(entry.id)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--ink-secondary)] transition hover:bg-black/5 hover:text-red-500 active:scale-90"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>

        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(entries.length / PAGE_SIZE))}
          onPage={setPage}
          label="Пагинация записей"
        />
      </section>

      {modalOpen && (
        <AddFoodModal
          date={date ?? todayIso()}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function todayIso(): string {
  // en-CA даёт YYYY-MM-DD в локальном времени.
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Модальное окно добавления: локальный поиск по foods (debounce), выбор блюда,
 * количество порций (по умолчанию 1), сохранение через createEntry.
 */
function AddFoodModal({
  date,
  onClose,
  onCreated,
}: {
  date: string;
  onClose: () => void;
  onCreated: (entry: FoodEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [recent, setRecent] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  const runSearch = (q: string) => {
    searchFoods(q).then((result) => {
      if (result.ok) setResults(result.data);
      setSearching(false);
    });
  };

  // При пустом запросе показываем не весь справочник, а последние
  // использованные блюда; если их нет — первые 5 блюд справочника.
  useEffect(() => {
    listRecentFoods().then((result) => {
      if (result.ok && result.data.length > 0) {
        setRecent(result.data);
        return;
      }
      listFoods().then((list) => {
        if (list.ok) setRecent(list.data.slice(0, 5));
      });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) {
        runSearch(query);
      } else {
        setResults([]);
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Максимум SUGGESTION_LIMIT подсказок: быстрый поиск, а не каталог.
  const suggestions = query.trim() ? results.slice(0, SUGGESTION_LIMIT) : recent.slice(0, SUGGESTION_LIMIT);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const result = await createEntry({
      foodId: selected.id,
      entryDate: date,
      quantity,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data);
    onClose();
  }

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="sheet-up glass-card h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-b-none rounded-t-[28px] p-5 pb-[calc(max(env(safe-area-inset-bottom),16px)+72px)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Добавить блюдо"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15" />

        <h2 className="mb-4 text-center text-lg font-bold">
          {selected ? selected.name : "Добавить блюдо"}
        </h2>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {!selected ? (
          <>
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearching(true);
              }}
              placeholder="Поиск блюда…"
              aria-label="Поиск блюда"
              className="glass-input w-full px-4 py-3.5 text-sm outline-none placeholder:text-[var(--ink-secondary)]"
            />
            <ul className="mt-3 space-y-2">
              {!query.trim() && suggestions.length > 0 && (
                <li className="px-2 pt-1 text-xs font-medium text-[var(--ink-secondary)]">
                  Последние блюда
                </li>
              )}
              {suggestions.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(food);
                      setQuantity(1);
                    }}
                    className="glass-control flex w-full items-center justify-between px-4 py-3 text-left transition active:scale-[0.98]"
                  >
                    <span className="truncate text-sm font-medium">{food.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-[var(--ink-secondary)]">
                      {Math.round(food.calories)} ккал
                    </span>
                  </button>
                </li>
              ))}
              {!searching && query.trim() && suggestions.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-[var(--ink-secondary)]">
                  Ничего не найдено. Создайте блюдо на странице «Блюда».
                </li>
              )}
            </ul>
          </>
        ) : (
          <div className="space-y-4">
            <div className="glass-control space-y-1 p-4 text-center">
              <p className="text-3xl font-bold">{Math.round(selected.calories * quantity)}</p>
              <p className="text-xs text-[var(--ink-secondary)]">
                ккал · Б {(selected.protein * quantity).toFixed(1)} · Ж{" "}
                {(selected.fat * quantity).toFixed(1)} · У {(selected.carbs * quantity).toFixed(1)}
              </p>
            </div>

            <div>
              <p className="mb-2 px-1 text-sm font-medium text-[var(--ink-secondary)]">
                Количество порций
              </p>
              <div className="glass-control flex items-center justify-between p-2">
                <button
                  type="button"
                  aria-label="Меньше порций"
                  onClick={() => setQuantity((q) => Math.max(0.25, Math.round((q - 0.5) * 100) / 100))}
                  className="size-11 rounded-[14px] bg-white/70 text-xl font-medium text-[var(--ink-secondary)] active:scale-95"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0.25}
                  max={50}
                  step={0.5}
                  value={quantity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) setQuantity(v);
                  }}
                  className="w-24 bg-transparent text-center text-lg font-semibold outline-none"
                  aria-label="Количество порций"
                />
                <button
                  type="button"
                  aria-label="Больше порций"
                  onClick={() => setQuantity((q) => Math.min(50, Math.round((q + 0.5) * 100) / 100))}
                  className="size-11 rounded-[14px] bg-white/70 text-xl font-medium text-[var(--ink-secondary)] active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="glass-control flex-1 py-3.5 text-sm font-semibold"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={saving || quantity <= 0 || quantity > 50}
                onClick={handleSave}
                className="flex-[2] rounded-[18px] bg-[var(--accent)] py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)] transition active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
