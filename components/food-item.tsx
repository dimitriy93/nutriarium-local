"use client";

import { useState } from "react";
import { softDeleteFood, updateFood } from "@/lib/repositories/foods";
import type { Food } from "@/lib/db";

const inputClass = "glass-input w-full px-3 py-2.5 text-sm";

function fmt(n: number): string {
  return Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

/**
 * Карточка блюда: название, калории, БЖУ и источник (AI / вручную).
 * Разворачивающееся редактирование (название + КБЖУ) и soft delete
 * с подтверждением — логика прежняя, сохранение идёт в IndexedDB.
 */
export default function FoodItem({
  food,
  onUpdated,
  onDeleted,
}: {
  food: Food;
  onUpdated: (food: Food) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    // Собираем patch только из реально переданных полей — частичное обновление.
    const patch: Record<string, string | number> = {
      name: String(formData.get("name") ?? ""),
    };
    for (const field of ["calories", "protein", "fat", "carbs"] as const) {
      const value = formData.get(field);
      if (value !== null && String(value).trim() !== "") {
        patch[field] = Number(value);
      }
    }
    const result = await updateFood(food.id, patch, { source: "manual" });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdated(result.data);
    setExpanded(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await softDeleteFood(food.id);
      if (result.ok) {
        onDeleted(food.id);
      } else {
        setDeleteError(result.error);
      }
    } catch {
      setDeleteError("Не удалось удалить блюдо, попробуйте ещё раз");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <li className="glass-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-semibold">{food.name}</p>
            <p className="shrink-0 text-base font-bold tracking-tight">
              {fmt(food.calories)}
              <span className="ml-1 text-xs font-medium text-[var(--ink-secondary)]">ккал</span>
            </p>
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--ink-secondary)]">
            <span>Б {fmt(food.protein)}</span>
            <span>Ж {fmt(food.fat)}</span>
            <span>У {fmt(food.carbs)}</span>
          </p>
          <span
            className="glass-badge mt-2 inline-block"
            style={
              food.source === "ai"
                ? { background: "#e5eeff", color: "#3a6fd8" }
                : { background: "rgba(60,60,67,0.08)", color: "var(--ink-secondary)" }
            }
          >
            {food.source === "ai" ? "AI" : "вручную"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setConfirmingDelete(false);
          }}
          aria-expanded={expanded}
          className="glass-control flex size-9 shrink-0 items-center justify-center transition"
          aria-label={expanded ? "Свернуть" : "Изменить блюдо"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={"text-[var(--ink-secondary)] transition-transform " + (expanded ? "rotate-180" : "")}
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="fade-in space-y-4 border-t border-black/5 bg-white/35 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(new FormData(e.currentTarget));
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor={`edit-name-${food.id}`} className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                Название
              </label>
              <input
                id={`edit-name-${food.id}`}
                name="name"
                type="text"
                defaultValue={food.name}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["calories", "Ккал", food.calories],
                  ["protein", "Белки, г", food.protein],
                  ["fat", "Жиры, г", food.fat],
                  ["carbs", "Углеводы, г", food.carbs],
                ] as const
              ).map(([name, label, value]) => (
                <div key={name}>
                  <label
                    htmlFor={`edit-${name}-${food.id}`}
                    className="mb-1.5 block text-xs text-[var(--ink-secondary)]"
                  >
                    {label}
                  </label>
                  <input
                    id={`edit-${name}-${food.id}`}
                    name={name}
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    defaultValue={value}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-[16px] bg-[var(--accent)] py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)] transition active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </form>

          <div className="space-y-2 text-xs text-[var(--ink-secondary)]">
            {confirmingDelete ? (
              <div className="space-y-2">
                <p className="font-medium text-[var(--ink)]">Удалить «{food.name}»?</p>
                <p>Записи дневника сохранятся.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-[14px] bg-red-500 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {deleting ? "Удаляем…" : "Да, удалить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="glass-control flex-1 py-2.5 font-semibold"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="w-full rounded-[14px] py-2.5 font-semibold text-red-500 transition hover:bg-red-50 active:scale-[0.98]"
              >
                Удалить блюдо
              </button>
            )}
            {deleteError && <p className="text-red-600">{deleteError}</p>}
          </div>
        </div>
      )}
    </li>
  );
}
