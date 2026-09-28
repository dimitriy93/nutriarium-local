"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getStats } from "@/lib/repositories/history";
import type { DayTotals } from "@/lib/history";

/**
 * Статистика за период (7/30/90 дней): один линейный график выбранного
 * показателя (Калории/Белок/Жиры/Углеводы) + средние за период.
 * Ряд день-за-днём строится локально из IndexedDB (lib/repositories/history);
 * пропущенные дни — нули, поэтому линия непрерывна. Локальная «сегодня»
 * вычисляется на клиенте.
 */

type MetricKey = "calories" | "protein" | "fat" | "carbs";

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: "calories", label: "Калории", unit: "ккал", color: "#34c78f" },
  { key: "protein", label: "Белок", unit: "г", color: "#5b9bf0" },
  { key: "fat", label: "Жиры", unit: "г", color: "#f0b35b" },
  { key: "carbs", label: "Углеводы", unit: "г", color: "#8f6bf0" },
];

const PERIODS = [7, 30, 90] as const;

const METRIC_LABELS: Record<MetricKey, string> = {
  calories: "Средние калории",
  protein: "Средний белок",
  fat: "Средние жиры",
  carbs: "Средние углеводы",
};

const PERIOD_LABELS: Record<number, string> = {
  7: "Среднее за 7 дней",
  30: "Среднее за 30 дней",
  90: "Среднее за 90 дней",
};

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export default function StatsClient() {
  const [days, setDays] = useState<DayTotals[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7);
  const [metric, setMetric] = useState<MetricKey>("calories");

  // Локальная дата известна только на клиенте — грузим после монтирования.
  useEffect(() => {
    const t = todayIso();
    getStats(shiftIso(t, -(period - 1)), t).then((result) => {
      if (result.ok) {
        setDays(result.data.days);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }, [period]);

  const meta = METRICS.find((m) => m.key === metric)!;
  const series = useMemo(() => (days ?? []).map((d) => d[metric]), [days, metric]);

  const average = useMemo(() => {
    if (series.length === 0) return 0;
    return series.reduce((a, b) => a + b, 0) / series.length;
  }, [series]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] space-y-5 px-5 pt-[max(env(safe-area-inset-top),48px)] pb-16">
      <header className="space-y-1 px-1">
        <h1 className="text-[28px] font-bold tracking-tight">Статистика</h1>
      </header>

      {/* Вкладки раздела */}
      <nav className="glass-control flex gap-1 p-1" aria-label="Разделы истории">
        <Link
          href="/history"
          className="flex-1 rounded-[14px] py-2.5 text-center text-sm font-medium text-[var(--ink-secondary)] transition active:scale-[0.98]"
        >
          Дни
        </Link>
        <span
          aria-current="page"
          className="flex-1 rounded-[14px] bg-white/80 py-2.5 text-center text-sm font-semibold text-[var(--ink)]"
        >
          Статистика
        </span>
      </nav>

      {error && <p className="glass-card px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* Период */}
      <div className="glass-control flex gap-1 p-1" role="tablist" aria-label="Период">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={
              "flex-1 rounded-[14px] py-2.5 text-sm font-semibold transition active:scale-[0.97] " +
              (period === p
                ? "bg-white/80 text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-secondary)]")
            }
          >
            {p} дней
          </button>
        ))}
      </div>

      {/* График */}
      <section className="glass-card space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{meta.label}</h2>
          <span className="text-xs font-medium text-[var(--ink-secondary)]">
            {meta.unit}
          </span>
        </div>
        {days === null ? (
          <p className="py-10 text-center text-sm text-[var(--ink-secondary)]">Загрузка…</p>
        ) : (
          <LineChart series={series} color={meta.color} />
        )}
        {/* Ось X: первая и последняя дата ряда */}
        {days && days.length > 0 && (
          <div className="flex justify-between px-0.5 text-[11px] font-medium text-[var(--ink-secondary)]">
            <span>{formatShort(days[0].date)}</span>
            <span>{formatShort(days[days.length - 1].date)}</span>
          </div>
        )}
      </section>

      {/* Переключатель показателя */}
      <div className="glass-control flex gap-1 p-1" role="tablist" aria-label="Показатель">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={
              "flex-1 rounded-[14px] px-1 py-2.5 text-[13px] font-semibold transition active:scale-[0.97] " +
              (metric === m.key
                ? "bg-white/80 text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-secondary)]")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Среднее за период */}
      <section className="glass-card flex items-baseline justify-between p-5">
        <p className="text-sm font-medium text-[var(--ink-secondary)]">
          {PERIOD_LABELS[period]}
        </p>
        <p className="text-2xl font-bold tracking-tight">
          {Math.round(average)}
          <span className="ml-1 text-xs font-semibold text-[var(--ink-secondary)]">
            {meta.unit}
          </span>
        </p>
      </section>

      {/* Скрытый лейбл для тестов/скринридеров о средней величине показателя */}
      <p className="sr-only">
        {METRIC_LABELS[metric]}: {Math.round(average)} {meta.unit}
      </p>
    </div>
  );
}

/**
 * Линейный график без внешних библиотек: SVG polyline в viewBox с padding.
 * Нулевая высота ряда (все значения равны) рисуется средней линией.
 */
function LineChart({ series, color }: { series: number[]; color: string }) {
  const W = 320;
  const H = 150;
  const P = 8;

  const max = Math.max(...series, 0);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const n = series.length;

  const points = series.map((v, i) => {
    const x = n === 1 ? W / 2 : P + ((W - 2 * P) * i) / (n - 1);
    const y = H - P - ((v - min) / range) * (H - 2 * P);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[150px] w-full"
      role="img"
      aria-label="График показателя по дням"
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Мягкая заливка под линией */}
      <polygon
        points={`${P},${H - P} ${points.join(" ")} ${W - P},${H - P}`}
        fill={color}
        opacity="0.12"
      />
    </svg>
  );
}

function formatShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${m}`;
}
