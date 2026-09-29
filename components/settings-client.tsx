"use client";

import { useEffect, useRef, useState } from "react";
import GoalWizard from "@/components/goal-wizard";
import { getAiApiKey, getGoals, getProfile, saveProfile, saveAiApiKey, clearAiApiKey } from "@/lib/repositories/settings";

/**
 * Форма настроек local-first версии: имя, дневные цели КБЖУ (ручной ввод +
 * Goal Wizard) и AI-помощник (Google AI API Key). Всё сохраняется в IndexedDB.
 *
 * Дневные цели — два режима (как в /nutriarium-base): ручной ввод и Goal
 * Wizard («Рассчитать цели»). Мастер возвращает рассчитанные КБЖУ; значения
 * подставляются в те же поля и форма отправляется, чтобы цели сохранились.
 *
 * API-ключ хранится только на устройстве пользователя (IndexedDB) и
 * используется браузером для прямых запросов к Google Gemini.
 */

const goalFields = [
  { name: "calorieGoal", label: "Калории", unit: "kcal", step: "10" },
  { name: "proteinGoal", label: "Белок", unit: "g", step: "5" },
  { name: "fatGoal", label: "Жиры", unit: "g", step: "5" },
  { name: "carbsGoal", label: "Углеводы", unit: "g", step: "5" },
] as const;

function formatGoal(value: number): string {
  return value > 0 ? String(value) : "";
}

export default function SettingsClient() {
  const [initialName, setInitialName] = useState<string | null>(null);
  const [initialGoals, setInitialGoals] = useState<Record<string, string> | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Ссылки на поля целей: мастер подставляет значения напрямую в DOM и
  // отправляет форму — React-контрол не нужен, поля остаются ручным вводом.
  const formRef = useRef<HTMLFormElement>(null);
  const goalInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    Promise.all([getProfile(), getGoals(), getAiApiKey()]).then(
      ([profile, goals, apiKey]) => {
        setInitialName(profile.displayName);
        setInitialGoals({
          calorieGoal: formatGoal(goals.calories),
          proteinGoal: formatGoal(goals.protein),
          fatGoal: formatGoal(goals.fat),
          carbsGoal: formatGoal(goals.carbs),
        });
        setHasApiKey(Boolean(apiKey));
        setAiLoaded(true);
      },
    );
  }, []);

  function handleWizardApply(goals: { calories: number; protein: number; fat: number; carbs: number }) {
    const byField: Record<string, number> = {
      calorieGoal: goals.calories,
      proteinGoal: goals.protein,
      fatGoal: goals.fat,
      carbsGoal: goals.carbs,
    };
    for (const [name, value] of Object.entries(byField)) {
      const input = goalInputRefs.current[name];
      if (input) input.value = String(value);
    }
    setWizardOpen(false);
    formRef.current?.requestSubmit();
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setState(null);
    const result = await saveProfile({
      displayName: String(formData.get("displayName") ?? ""),
      calorieGoal: Number(formData.get("calorieGoal")),
      proteinGoal: Number(formData.get("proteinGoal")),
      fatGoal: Number(formData.get("fatGoal")),
      carbsGoal: Number(formData.get("carbsGoal")),
    });
    setPending(false);
    if (!result.ok) {
      setState({ ok: false, message: result.error });
      return;
    }
    setState({ ok: true, message: "Настройки сохранены" });
  }

  async function handleSaveAi() {
    if (apiKeyInput.trim() === "") {
      setState({ ok: false, message: "Вставьте Google AI API Key" });
      return;
    }
    const result = await saveAiApiKey(apiKeyInput);
    if (!result.ok) {
      setState({ ok: false, message: result.error });
      return;
    }
    setApiKeyInput("");
    setHasApiKey(true);
    setState({ ok: true, message: "API-ключ сохранён на этом устройстве" });
  }

  async function handleDeleteAi() {
    const result = await clearAiApiKey();
    if (!result.ok) {
      setState({ ok: false, message: result.error });
      return;
    }
    setApiKeyInput("");
    setHasApiKey(false);
    setState({ ok: true, message: "Ключ удалён — AI-помощник отключён" });
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(new FormData(e.currentTarget));
        }}
        className="space-y-7"
      >
        {/* Profile */}
        <section className="space-y-2.5">
          <h2 className="section-title">Профиль</h2>
          <div className="glass-card space-y-3 p-5">
            <label htmlFor="displayName" className="block text-sm font-medium text-[var(--ink-secondary)]">
              Имя
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              defaultValue={initialName ?? ""}
              key={initialName ?? "name"}
              maxLength={60}
              autoComplete="name"
              placeholder="Как к вам обращаться?"
              className="glass-input w-full px-4 py-3.5 text-base outline-none placeholder:text-[var(--ink-secondary)]"
            />
          </div>
        </section>

        {/* Daily Targets — ручной ввод + расчёт через Goal Wizard */}
        <section className="space-y-2.5">
          <h2 className="section-title">Дневные цели</h2>
          <div className="glass-card space-y-4 p-5">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="glass-control flex w-full items-center justify-between px-4 py-3 text-left active:scale-[0.98]"
            >
              <span className="min-w-0">
                <span className="block text-base font-semibold">Рассчитать цели</span>
                <span className="block text-xs text-[var(--ink-secondary)]">
                  Пол, возраст, активность — и цели подберутся автоматически
                </span>
              </span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0 text-[var(--accent)]">
                <path
                  d="M10 4.5v11M4.5 10h11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {goalFields.map(({ name, label, unit, step }) => (
              <div key={name} className="flex items-center gap-3">
                <label htmlFor={name} className="flex-1 text-base font-medium">
                  {label}
                </label>
                <div className="glass-control flex items-center gap-2 px-4 py-2.5">
                  <input
                    id={name}
                    name={name}
                    ref={(el) => {
                      goalInputRefs.current[name] = el;
                    }}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={step}
                    defaultValue={initialGoals?.[name] ?? ""}
                    key={initialGoals ? name : `${name}-init`}
                    placeholder="—"
                    className="w-20 bg-transparent text-right text-base font-semibold outline-none placeholder:text-[var(--ink-secondary)]"
                  />
                  <span className="w-9 text-xs text-[var(--ink-secondary)]">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {state && (
          <p className={`glass-card px-4 py-3 text-sm ${state.ok ? "text-[#1d8a60]" : "text-red-600"}`}>
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[24px] bg-[var(--accent)] py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)] transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>

      {/* AI — единственная сетевая функция. Ключ хранится только локально. */}
      <section className="space-y-2.5">
        <h2 className="section-title">AI-помощник</h2>
        <div className="glass-card space-y-3 p-5">
          <label htmlFor="apiKey" className="block text-sm font-medium text-[var(--ink-secondary)]">
            Google AI API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            disabled={!aiLoaded}
            autoComplete="off"
            placeholder={hasApiKey ? "••••••••••••••••••••" : "Вставьте ключ из Google AI Studio"}
            className="glass-input w-full px-4 py-3.5 text-sm outline-none placeholder:text-[var(--ink-secondary)]"
          />
          {hasApiKey && (
            <p className="text-xs text-[#1d8a60]">Ключ сохранён на этом устройстве.</p>
          )}
          <p className="text-xs text-[var(--ink-secondary)]">
            API-ключ хранится только на этом устройстве и используется браузером
            для запросов к Google Gemini. Nutriarium не отправляет ключ на
            собственный сервер. Без ключа AI-функция недоступна — всё остальное
            работает оффлайн.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveAi}
              disabled={!aiLoaded}
              className="glass-control flex-[2] py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={handleDeleteAi}
              disabled={!aiLoaded || !hasApiKey}
              className="glass-control flex-1 py-3 text-sm font-semibold text-[var(--ink-secondary)] disabled:opacity-40"
            >
              Удалить ключ
            </button>
          </div>
        </div>
      </section>

      {/* Локальный характер хранения данных */}
      <p className="px-1 text-xs text-[var(--ink-secondary)]">
        Данные хранятся только на этом устройстве (IndexedDB браузера).
        Синхронизации между устройствами нет.
      </p>

      {wizardOpen && (
        <GoalWizard onClose={() => setWizardOpen(false)} onApply={handleWizardApply} />
      )}
    </>
  );
}
