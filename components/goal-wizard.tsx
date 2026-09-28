"use client";

import { useMemo, useState } from "react";
import {
  calculateGoals,
  type ActivityLevel,
  type CalculatedGoals,
  type Gender,
  type GoalType,
} from "@/lib/goals";

/**
 * Goal Wizard (этап 8.5): пошаговый расчёт дневных целей в стиле iOS bottom
 * sheet — glass, mobile-first. 7 шагов: пол, возраст, рост, вес, активность,
 * цель, необязательные предпочтения; затем экран результата с расчётом по
 * Mifflin-St Jeor (lib/goals.ts) и кнопкой «Использовать эти значения».
 */

interface GoalWizardProps {
  onClose: () => void;
  onApply: (goals: CalculatedGoals) => void;
}

interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

const ACTIVITY_OPTIONS: Option<ActivityLevel>[] = [
  { value: "sedentary", label: "Сидячий образ жизни", hint: "офис, мало ходьбы" },
  { value: "light", label: "Низкая активность", hint: "прогулки 1–3 раза в неделю" },
  { value: "moderate", label: "Умеренная активность", hint: "тренировки 3–5 раз в неделю" },
  { value: "high", label: "Высокая активность", hint: "тренировки почти каждый день" },
];

const GOAL_OPTIONS: Option<GoalType>[] = [
  { value: "loss", label: "Похудение", hint: "умеренный дефицит калорий" },
  { value: "maintain", label: "Поддержание", hint: "держать текущий вес" },
  { value: "gain", label: "Набор массы", hint: "небольшой профицит калорий" },
];

const TOTAL_STEPS = 7;

export default function GoalWizard({ onClose, onApply }: GoalWizardProps) {
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [minProteinG, setMinProteinG] = useState("");
  const [maxFatG, setMaxFatG] = useState("");
  const [fixedCalories, setFixedCalories] = useState("");
  const [showResult, setShowResult] = useState(false);

  const result = useMemo<CalculatedGoals | null>(() => {
    if (
      gender === null ||
      age === null ||
      heightCm === null ||
      weightKg === null ||
      activity === null ||
      goal === null
    ) {
      return null;
    }
    const toNum = (s: string) => {
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    return calculateGoals({
      gender,
      age,
      heightCm,
      weightKg,
      activity,
      goal,
      minProteinG: toNum(minProteinG),
      maxFatG: toNum(maxFatG),
      fixedCalories: toNum(fixedCalories),
    });
  }, [gender, age, heightCm, weightKg, activity, goal, minProteinG, maxFatG, fixedCalories]);

  const canContinue =
    (step === 0 && gender !== null) ||
    (step === 1 && age !== null && age >= 14 && age <= 100) ||
    (step === 2 && heightCm !== null && heightCm >= 100 && heightCm <= 250) ||
    (step === 3 && weightKg !== null && weightKg >= 30 && weightKg <= 300) ||
    (step === 4 && activity !== null) ||
    (step === 5 && goal !== null) ||
    step === 6;

  function handleContinue() {
    if (step === TOTAL_STEPS - 1) {
      if (result) setShowResult(true);
      return;
    }
    setStep(step + 1);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* затемнение */}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm fade-in"
      />

      {/* bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Рассчитать дневные цели"
        className="sheet-up relative w-full max-w-[430px] rounded-t-[28px] bg-white/75 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-12px_48px_rgba(31,41,55,0.22)] backdrop-blur-2xl"
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[rgba(60,60,67,0.25)]" />

        {showResult && result ? (
          <ResultView
            result={result}
            onBack={() => setShowResult(false)}
            onApply={() => onApply(result)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-3">
              <button
                type="button"
                onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
                className="rounded-full px-2 py-1 text-sm font-medium text-[var(--ink-secondary)] active:opacity-60"
              >
                {step === 0 ? "Отмена" : "Назад"}
              </button>
              <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                {step + 1} / {TOTAL_STEPS}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть мастер"
                className="flex size-7 items-center justify-center rounded-full bg-[rgba(60,60,67,0.12)] text-sm text-[var(--ink-secondary)] active:opacity-60"
              >
                ✕
              </button>
            </div>

            {/* прогресс */}
            <div className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-[rgba(60,60,67,0.09)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
              />
            </div>

            <div className="space-y-5 px-5 pb-4 pt-5">
              {step === 0 && (
                <StepShell title="Ваш пол">
                  <div className="grid grid-cols-2 gap-3">
                    <ChoiceCard
                      label="Мужчина"
                      selected={gender === "male"}
                      onClick={() => setGender("male")}
                    />
                    <ChoiceCard
                      label="Женщина"
                      selected={gender === "female"}
                      onClick={() => setGender("female")}
                    />
                  </div>
                </StepShell>
              )}

              {step === 1 && (
                <StepShell title="Сколько вам лет?" unit="лет">
                  <NumberField
                    value={age}
                    onChange={setAge}
                    min={14}
                    max={100}
                    step={1}
                  />
                </StepShell>
              )}

              {step === 2 && (
                <StepShell title="Ваш рост" unit="см">
                  <NumberField
                    value={heightCm}
                    onChange={setHeightCm}
                    min={100}
                    max={250}
                    step={1}
                  />
                </StepShell>
              )}

              {step === 3 && (
                <StepShell title="Ваш вес" unit="кг">
                  <NumberField
                    value={weightKg}
                    onChange={setWeightKg}
                    min={30}
                    max={300}
                    step={0.5}
                  />
                </StepShell>
              )}

              {step === 4 && (
                <StepShell title="Уровень активности">
                  <div className="space-y-2.5">
                    {ACTIVITY_OPTIONS.map((o) => (
                      <ChoiceRow
                        key={o.value}
                        label={o.label}
                        hint={o.hint}
                        selected={activity === o.value}
                        onClick={() => setActivity(o.value)}
                      />
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 5 && (
                <StepShell title="Ваша цель">
                  <div className="space-y-2.5">
                    {GOAL_OPTIONS.map((o) => (
                      <ChoiceRow
                        key={o.value}
                        label={o.label}
                        hint={o.hint}
                        selected={goal === o.value}
                        onClick={() => setGoal(o.value)}
                      />
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 6 && (
                <StepShell title="Особые предпочтения" subtitle="Необязательно — можно пропустить">
                  <div className="space-y-3">
                    <PrefField
                      id="wiz-min-protein"
                      label="Белок — минимум, г"
                      value={minProteinG}
                      onChange={setMinProteinG}
                      placeholder="Например, 120"
                    />
                    <PrefField
                      id="wiz-max-fat"
                      label="Жиры — максимум, г"
                      value={maxFatG}
                      onChange={setMaxFatG}
                      placeholder="Например, 60"
                    />
                    <PrefField
                      id="wiz-fixed-cal"
                      label="Зафиксировать калории, ккал"
                      value={fixedCalories}
                      onChange={setFixedCalories}
                      placeholder="Например, 2000"
                    />
                  </div>
                </StepShell>
              )}
            </div>

            <div className="px-5">
              <button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue}
                className="w-full rounded-[24px] bg-[var(--accent)] py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)] transition active:scale-[0.98] disabled:opacity-50"
              >
                {step === TOTAL_STEPS - 1 ? "Рассчитать" : "Далее"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  unit,
  children,
}: {
  title: string;
  subtitle?: string;
  unit?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-xl font-bold tracking-tight">
          {title}
          {unit && <span className="ml-1.5 text-base font-medium text-[var(--ink-secondary)]">{unit}</span>}
        </h3>
        {subtitle && <p className="text-sm text-[var(--ink-secondary)]">{subtitle}</p>}
      </div>
      {/* содержимое шага */}
      {children}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <StepperButton
        label="−"
        onClick={() => onChange(Math.max(min, (value ?? Math.round((min + max) / 2)) - step))}
      />
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(e.target.value === "" ? null : n);
        }}
        className="glass-input w-32 py-3 text-center text-3xl font-bold outline-none"
      />
      <StepperButton
        label="+"
        onClick={() => onChange(Math.min(max, (value ?? Math.round((min + max) / 2)) + step))}
      />
    </div>
  );
}

function StepperButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-control flex size-11 items-center justify-center text-xl font-semibold active:scale-95"
      aria-label={label === "−" ? "Уменьшить" : "Увеличить"}
    >
      {label}
    </button>
  );
}

function ChoiceCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-[18px] py-4 text-base font-semibold transition active:scale-[0.97] " +
        (selected
          ? "bg-[var(--accent)] text-white shadow-[0_6px_18px_rgba(52,199,143,0.4)]"
          : "glass-control text-[var(--ink)]")
      }
    >
      {label}
    </button>
  );
}

function ChoiceRow({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center justify-between rounded-[18px] px-4 py-3.5 text-left transition active:scale-[0.98] " +
        (selected
          ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]"
          : "glass-control")
      }
    >
      <span className="min-w-0">
        <span className="block text-base font-semibold">{label}</span>
        {hint && <span className="block text-xs text-[var(--ink-secondary)]">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={
          "ml-3 flex size-5 shrink-0 items-center justify-center rounded-full border-2 " +
          (selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[rgba(60,60,67,0.3)]")
        }
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5 5 9l4.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

function PrefField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-[var(--ink-secondary)]">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="glass-input w-28 px-3 py-2.5 text-right text-base font-semibold outline-none placeholder:text-sm placeholder:font-normal placeholder:text-[var(--ink-secondary)]"
      />
    </div>
  );
}

function ResultView({
  result,
  onApply,
  onBack,
}: {
  result: CalculatedGoals;
  onApply: () => void;
  onBack: () => void;
}) {
  const rows = [
    { label: "Калории", value: result.calories, unit: "ккал" },
    { label: "Белки", value: result.protein, unit: "г" },
    { label: "Жиры", value: result.fat, unit: "г" },
    { label: "Углеводы", value: result.carbs, unit: "г" },
  ] as const;

  return (
    <div className="space-y-5 px-5 pb-2 pt-5">
      <div className="space-y-1 text-center">
        <h3 className="text-xl font-bold tracking-tight">Ваши дневные цели</h3>
        <p className="text-sm text-[var(--ink-secondary)]">
          Цели рассчитаны автоматически по формуле Mifflin-St Jeor с учётом
          активности и вашей цели.
        </p>
      </div>

      <div className="glass-card divide-y divide-[rgba(60,60,67,0.08)] px-5 py-1">
        {rows.map(({ label, value, unit }) => (
          <div key={label} className="flex items-center justify-between py-3">
            <span className="text-base font-medium">{label}</span>
            <span className="text-base font-bold">
              {value} <span className="text-xs font-medium text-[var(--ink-secondary)]">{unit}</span>
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onApply}
        className="w-full rounded-[24px] bg-[var(--accent)] py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)] transition active:scale-[0.98]"
      >
        Использовать эти значения
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full py-1 text-sm font-medium text-[var(--ink-secondary)] active:opacity-60"
      >
        Изменить параметры
      </button>
    </div>
  );
}