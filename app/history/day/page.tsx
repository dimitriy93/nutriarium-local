"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BottomNav from "@/components/bottom-nav";
import { getDayDetail } from "@/lib/repositories/history";
import { getGoals } from "@/lib/repositories/settings";
import { formatDateRu } from "@/lib/format";
import type { FoodEntry } from "@/lib/db";
import type { Macros } from "@/lib/diary";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Детальный просмотр дня истории: итоговые КБЖУ и список блюд.
 * Показываются только snapshot-значения на момент записи — последующее
 * редактирование блюд в базе историю не меняет.
 *
 * Роутинг: вместо /history/[date] используется /history/day?date=YYYY-MM-DD —
 * динамический сегмент несовместим со статическим экспортом GitHub Pages
 * (нужен generateStaticParams, а даты известны только в браузере).
 */
export default function DayDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-sm text-[var(--ink-secondary)]">
          Загрузка…
        </main>
      }
    >
      <DayDetail />
      <BottomNav />
    </Suspense>
  );
}

function DayDetail() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? "";
  const valid = DATE_RE.test(date);

  const [totals, setTotals] = useState<Macros | null>(null);
  const [entries, setEntries] = useState<FoodEntry[] | null>(null);
  const [goals, setGoals] = useState<Macros | null>(null);

  useEffect(() => {
    if (!valid) return;
    Promise.all([getDayDetail(date), getGoals()]).then(([detail, goalsValue]) => {
      setTotals(detail.totals);
      setEntries(detail.entries);
      setGoals(goalsValue);
    });
  }, [date, valid]);

  if (!valid) {
    return (
      <main className="pb-32">
        <div className="mx-auto min-h-dvh w-full max-w-[430px] space-y-5 px-5 pt-[max(env(safe-area-inset-top),48px)] pb-16">
          <header className="space-y-2 px-1">
            <BackLink />
            <h1 className="text-[28px] font-bold tracking-tight">Некорректная дата</h1>
          </header>
          <div className="glass-card px-4 py-6 text-center text-sm text-[var(--ink-secondary)]">
            Ожидается формат YYYY-MM-DD в параметре date.
          </div>
        </div>
      </main>
    );
  }

  const loading = totals === null || entries === null || goals === null;
  const kcalPct = !loading && goals.calories > 0
    ? Math.min(100, (totals.calories / goals.calories) * 100)
    : 0;

  const macros: { label: string; value: number; goal: number; color: string }[] = loading
    ? []
    : [
        { label: "Белки", value: totals.protein, goal: goals.protein, color: "#5b9bf0" },
        { label: "Жиры", value: totals.fat, goal: goals.fat, color: "#f0b35b" },
        { label: "Углеводы", value: totals.carbs, goal: goals.carbs, color: "#8f6bf0" },
      ];

  return (
    <main className="pb-32">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] space-y-5 px-5 pt-[max(env(safe-area-inset-top),48px)] pb-16">
        <header className="space-y-2 px-1">
          <BackLink />
          <h1 className="text-[28px] font-bold tracking-tight">
            {formatDateRu(date)}
          </h1>
          <p className="text-sm font-medium text-[var(--ink-secondary)]">{date}</p>
        </header>

        {loading ? (
          <p className="glass-card px-4 py-8 text-center text-sm text-[var(--ink-secondary)]">
            Загрузка…
          </p>
        ) : (
          <>
            <section className="glass-card space-y-4 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--ink-secondary)]">Калории</p>
                  <p className="mt-1.5 text-[44px] leading-none font-bold tracking-tight">
                    {Math.round(totals.calories)}
                    <span className="text-lg font-semibold text-[var(--ink-secondary)]">
                      {" "}/ {goals.calories}
                    </span>
                  </p>
                </div>
                <span className="glass-badge" style={{ background: "var(--accent-soft)", color: "#1d8a60" }}>
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
                {macros.map(({ label, value, goal, color }) => (
                  <div key={label} className="space-y-1.5">
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
                        <span className="font-semibold text-[var(--ink)]">{Math.round(value)}</span>
                        {" "}/ {goal}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, goal > 0 ? (value / goal) * 100 : 0)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="section-title px-1">Записи ({entries.length})</h2>
              {entries.length === 0 ? (
                <div className="glass-card px-4 py-6 text-center text-sm text-[var(--ink-secondary)]">
                  В этот день записей не было.
                </div>
              ) : (
                <ul className="space-y-3">
                  {entries.map((entry) => (
                    <li key={entry.id} className="glass-card flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate font-semibold">{entry.nameSnapshot}</p>
                          <p className="shrink-0 text-base font-bold tracking-tight">
                            {Math.round(entry.caloriesSnapshot * entry.quantity)}
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
                          <span>Б {(entry.proteinSnapshot * entry.quantity).toFixed(1)}</span>
                          <span>Ж {(entry.fatSnapshot * entry.quantity).toFixed(1)}</span>
                          <span>У {(entry.carbsSnapshot * entry.quantity).toFixed(1)}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/history"
      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-secondary)] transition active:scale-95"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M15 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      История
    </Link>
  );
}
