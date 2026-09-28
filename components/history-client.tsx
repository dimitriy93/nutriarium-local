"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/bottom-nav";
import { listDayTotals } from "@/lib/repositories/history";
import { getGoals } from "@/lib/repositories/settings";
import { formatDateRu } from "@/lib/format";
import type { DayTotals } from "@/lib/history";
import type { Macros } from "@/lib/diary";

/**
 * История питания: список дней с итогами КБЖУ (snapshot * quantity), новые
 * сверху. Данные читаются напрямую из IndexedDB через lib/repositories/history;
 * отдельная таблица истории не нужна — объём данных мал.
 */
export default function HistoryClient() {
  const [days, setDays] = useState<DayTotals[] | null>(null);
  const [goals, setGoals] = useState<Macros | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listDayTotals(), getGoals()])
      .then(([totalsResult, goalsValue]) => {
        if (totalsResult.ok) {
          setDays(totalsResult.data);
          setError(null);
        } else {
          setError(totalsResult.error);
        }
        setGoals(goalsValue);
      })
      .catch(() => setError("Не удалось загрузить историю"));
  }, []);

  return (
    <main className="pb-32">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] space-y-5 px-5 pt-[max(env(safe-area-inset-top),48px)] pb-16">
        <header className="space-y-1 px-1">
          <h1 className="text-[28px] font-bold tracking-tight">История</h1>
        </header>

        {/* Вкладки раздела */}
        <nav className="glass-control flex gap-1 p-1" aria-label="Разделы истории">
          <span
            aria-current="page"
            className="flex-1 rounded-[14px] bg-white/80 py-2.5 text-center text-sm font-semibold text-[var(--ink)]"
          >
            Дни
          </span>
          <Link
            href="/history/stats"
            className="flex-1 rounded-[14px] py-2.5 text-center text-sm font-medium text-[var(--ink-secondary)] transition active:scale-[0.98]"
          >
            Статистика
          </Link>
        </nav>

        {error && <p className="glass-card px-4 py-3 text-sm text-red-600">{error}</p>}

        {days === null && !error && (
          <p className="glass-card px-4 py-8 text-center text-sm text-[var(--ink-secondary)]">
            Загрузка…
          </p>
        )}

        {days !== null && days.length === 0 && (
          <div className="glass-card px-4 py-8 text-center text-sm text-[var(--ink-secondary)]">
            Пока нет записей. Добавьте первое блюдо в дневнике.
          </div>
        )}

        {days !== null && days.length > 0 && goals && (
          <ul className="space-y-3">
            {days.map((day) => {
              const kcalPct = Math.min(
                100,
                goals.calories > 0 ? (day.calories / goals.calories) * 100 : 0,
              );
              return (
                <li key={day.date}>
                  <Link
                    href={`/history/day?date=${day.date}`}
                    className="glass-card block space-y-2.5 p-5 transition active:scale-[0.98]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="font-semibold">{formatDateRu(day.date)}</h2>
                      <span className="glass-badge" style={{ background: "var(--accent-soft)", color: "#1d8a60" }}>
                        {Math.round(kcalPct)}%
                      </span>
                    </div>
                    <p className="text-[26px] leading-none font-bold tracking-tight">
                      {Math.round(day.calories)}
                      <span className="text-sm font-semibold text-[var(--ink-secondary)]">
                        {" "}/ {Math.round(goals.calories)} ккал
                      </span>
                    </p>
                    <div className="progress-track h-2">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${kcalPct}%`,
                          background: "linear-gradient(90deg,#2fbf85,#34c78f)",
                        }}
                      />
                    </div>
                    <p className="flex gap-x-4 text-xs font-medium text-[var(--ink-secondary)]">
                      <span>Б {Math.round(day.protein)}</span>
                      <span>Ж {Math.round(day.fat)}</span>
                      <span>У {Math.round(day.carbs)}</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
