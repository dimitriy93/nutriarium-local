"use client";

import { useEffect, useRef, useState } from "react";
import { createFood, searchFoods } from "@/lib/repositories/foods";
import { estimateFood } from "@/lib/ai/estimate";
import type { FoodInput } from "@/lib/validation";
import type { Food } from "@/lib/db";

const inputClass = "glass-input w-full px-3 py-2.5 text-sm placeholder:text-[var(--ink-secondary)]";

type FormValues = { name: string; calories: string; protein: string; fat: string; carbs: string };

const emptyValues: FormValues = { name: "", calories: "", protein: "", fat: "", carbs: "" };

/**
 * Форма создания блюда: вручную или по AI-предложению.
 *
 * «Рассчитать через AI» — всегда явное действие пользователя: запрос уходит во
 * внешний AI-proxy (ключ только там), результат заполняет поля формы —
 * пользователь проверяет, при необходимости правит значения и сохраняет через
 * обычный createFood. AI никогда не пишет в базу сам. Поиск похожих блюд
 * выполняется локально, без AI.
 */
export default function CreateFoodForm({ onCreated }: { onCreated: (food: Food) => void }) {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hasAiSuggestion, setHasAiSuggestion] = useState(false);

  // Подсказка похожих блюд при вводе названия — защита от очевидных дубликатов.
  // Обычный локальный поиск, без AI.
  const [similar, setSimilar] = useState<Food[]>([]);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNameChange(value: string) {
    setValues((v) => ({ ...v, name: value }));
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setSimilar([]);
      return;
    }
    nameDebounceRef.current = setTimeout(async () => {
      const result = await searchFoods(trimmed);
      if (result.ok) setSimilar(result.data.slice(0, 5));
    }, 300);
  }

  async function handleEstimate() {
    const text = values.name.trim();
    if (!text || aiPending) return;
    setAiPending(true);
    setAiError(null);
    const result = await estimateFood(text);
    setAiPending(false);
    if (!result.ok) {
      setAiError(result.error);
      return;
    }
    const s: FoodInput = result.data;
    setValues({
      name: s.name,
      calories: String(s.calories),
      protein: String(s.protein),
      fat: String(s.fat),
      carbs: String(s.carbs),
    });
    setHasAiSuggestion(true);
    setSimilar([]);
  }

  useEffect(() => {
    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    };
  }, []);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createFood(
      {
        name: String(formData.get("name") ?? ""),
        calories: Number(formData.get("calories")),
        protein: Number(formData.get("protein")),
        fat: Number(formData.get("fat")),
        carbs: Number(formData.get("carbs")),
      },
      // Форма сохранена со значениями, заполненными из AI-предложения.
      { source: hasAiSuggestion ? "ai" : "manual" },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data);
    setValues(emptyValues);
    setSimilar([]);
    setHasAiSuggestion(false);
    setAiError(null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(new FormData(e.currentTarget));
      }}
      className="glass-card space-y-4 p-5"
    >
      <h2 className="text-base font-bold tracking-tight">Новое блюдо</h2>

      <div className="space-y-1.5">
        <label htmlFor="create-name" className="block text-xs font-medium text-[var(--ink-secondary)]">
          Название (с порцией, например «Гречневая каша 250 г с молоком»)
        </label>
        <input
          id="create-name"
          name="name"
          type="text"
          required
          value={values.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className={inputClass}
        />
      </div>

      {similar.length > 0 && (
        <div className="fade-in space-y-1 rounded-[16px] p-3 text-xs"
          style={{ background: "#fdf3dc", color: "#8a6d1f" }}
        >
          <p className="font-semibold">Похожие блюда уже есть:</p>
          <ul className="space-y-0.5">
            {similar.map((f) => (
              <li key={f.id}>
                {f.name} — {Number(f.calories).toLocaleString("ru-RU")} ккал
              </li>
            ))}
          </ul>
          <p className="opacity-80">Если это то же блюдо, создавать новое не нужно.</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleEstimate}
        disabled={aiPending || values.name.trim().length < 3}
        className="glass-control w-full py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
      >
        {aiPending ? "Рассчитываем…" : "✨ Рассчитать через AI"}
      </button>
      <p className="text-xs text-[var(--ink-secondary)]">
        AI рассчитает КБЖУ по описанию порции — проверьте значения перед сохранением.
      </p>
      {aiError && <p className="text-sm text-red-600">{aiError}</p>}

      {hasAiSuggestion && (
        <div className="fade-in rounded-[16px] p-3 text-xs" style={{ background: "var(--accent-soft)", color: "#1d8a60" }}>
          <p className="font-semibold">AI предлагает значения ниже — проверьте и исправьте при необходимости.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {(
          [
            ["calories", "Ккал"],
            ["protein", "Белки, г"],
            ["fat", "Жиры, г"],
            ["carbs", "Углеводы, г"],
          ] as const
        ).map(([field, label]) => (
          <div key={field}>
            <label htmlFor={`create-${field}`} className="mb-1.5 block text-xs text-[var(--ink-secondary)]">
              {label}
            </label>
            <input
              id={`create-${field}`}
              name={field}
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              required
              value={values[field]}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[18px] bg-[var(--accent)] py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)] transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : hasAiSuggestion ? "Сохранить блюдо" : "Создать блюдо"}
      </button>
    </form>
  );
}
