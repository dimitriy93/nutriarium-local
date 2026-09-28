"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listFoods, searchFoods } from "@/lib/repositories/foods";
import CreateFoodForm from "@/components/create-food-form";
import EmptyIllustration from "@/components/empty-illustration";
import FoodItem from "@/components/food-item";
import Pagination from "@/components/pagination";
import type { Food } from "@/lib/db";

/** Размер страницы списка блюд. */
const PAGE_SIZE = 12;

/**
 * Клиентская часть /foods: список + debounce-поиск + создание.
 * Список загружается из IndexedDB при монтировании (лениво, после hydration);
 * поиск выполняется тоже локально — реализация изолирована в
 * lib/repositories/foods.ts. Пагинация клиентская: список блюд приходит
 * целиком, на странице показывается PAGE_SIZE элементов.
 */
export default function FoodsClient({ hasEmptyIllustration }: { hasEmptyIllustration: boolean }) {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    const result = await listFoods();
    if (result.ok) {
      setFoods(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsSearching(false);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const result = await searchFoods(q);
    if (result.ok) {
      setFoods(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsSearching(false);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
    setIsSearching(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        void runSearch(value);
      } else {
        void loadAll();
      }
    }, 300);
  }

  useEffect(() => {
    void loadAll();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadAll]);

  const handleCreated = useCallback((food: Food) => {
    setFoods((prev) =>
      [...(prev ?? []), food].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    );
  }, []);

  const handleUpdated = useCallback((food: Food) => {
    setFoods((prev) =>
      (prev ?? []).map((f) => (f.id === food.id ? food : f)).sort((a, b) => a.name.localeCompare(b.name, "ru")),
    );
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setFoods((prev) => {
      const next = (prev ?? []).filter((f) => f.id !== id);
      // Остаёмся на текущей странице; если она опустела — на предыдущую.
      setPage((p) => Math.max(1, Math.min(p, Math.ceil(next.length / PAGE_SIZE))));
      return next;
    });
  }, []);

  const list = foods ?? [];
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <CreateFoodForm onCreated={handleCreated} />

      <section className="space-y-3">
        <h2 className="section-title">
          База блюд ({list.length})
        </h2>

        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--ink-secondary)]"
          >
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path
              d="m16 16 4.5 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Поиск: например «каша»"
            aria-label="Поиск блюд"
            className="glass-input w-full py-3 pr-4 pl-10 text-sm placeholder:text-[var(--ink-secondary)]"
          />
        </div>

        {error && (
          <p className="glass-card px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        {isSearching && (
          <p className="px-1 text-sm text-[var(--ink-secondary)]">Ищем…</p>
        )}

        {!isSearching && !error && foods === null && (
          <p className="px-1 text-sm text-[var(--ink-secondary)]">Загрузка…</p>
        )}

        {!isSearching && !error && foods !== null && foods.length === 0 && (
          <div className="glass-card px-4 py-3">
            {query.trim() ? (
              <p className="py-3 text-center text-sm text-[var(--ink-secondary)]">
                Ничего не найдено. Можно создать блюдо через форму выше.
              </p>
            ) : (
              <EmptyIllustration
                hasImage={hasEmptyIllustration}
                caption="Блюд пока нет. Добавьте первое блюдо вручную или воспользуйтесь AI-помощником."
              />
            )}
          </div>
        )}

        {!isSearching && current.length > 0 && (
          <ul className="space-y-3">
            {current.map((food) => (
              <FoodItem
                key={food.id}
                food={food}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          pageCount={pageCount}
          onPage={setPage}
          label="Пагинация блюд"
        />
      </section>
    </div>
  );
}
