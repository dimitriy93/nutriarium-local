import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createFood } from "@/lib/repositories/foods";
import { createEntry } from "@/lib/repositories/diary";
import { saveAiApiKey, saveGoals } from "@/lib/repositories/settings";
import { buildNutritionExport, EXPORT_SCHEMA_VERSION } from "@/lib/export/export";
import { foodInputSchema } from "@/lib/validation";
import { parseAiSuggestion, AiError } from "@/lib/ai/estimate";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const greek = { name: "Гречка 250 г", calories: 400, protein: 20, fat: 10, carbs: 60 };
const oat = { name: "Овсянка", calories: 250, protein: 10, fat: 5, carbs: 40 };

describe("export: buildNutritionExport (итоги дня для Silentium)", () => {
  it("содержит только schemaVersion, source, date и суммарное КБЖУ", async () => {
    const food = await createFood(greek, { source: "ai" });
    if (!food.ok) throw new Error("create failed");
    await createFood(oat);
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-29", quantity: 2 });

    const exported = await buildNutritionExport("2026-09-29");

    expect(exported.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(EXPORT_SCHEMA_VERSION).toBe(1);
    expect(exported.source).toBe("nutriarium");
    expect(exported.date).toBe("2026-09-29");
    // snapshot × quantity по всем записям дня.
    expect(exported.nutrition).toEqual({
      calories: 800,
      protein: 40,
      fat: 20,
      carbs: 120,
    });

    // Контракт: ровно четыре поля верхнего уровня, без продуктов/целей/настроек.
    expect(Object.keys(exported).sort()).toEqual(
      ["date", "nutrition", "schemaVersion", "source"],
    );

    // JSON-сериализуемость (для clipboard).
    expect(() => JSON.stringify(exported)).not.toThrow();
  });

  it("не включает блюда, цели и API-ключ", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-29", quantity: 1 });
    await saveGoals({ calories: 2100, protein: 130, fat: 65, carbs: 240 });
    await saveAiApiKey("AIzaSySecretKey1234567890");

    const json = JSON.stringify(await buildNutritionExport("2026-09-29"));
    const parsed = JSON.parse(json);

    expect(parsed.data).toBeUndefined();
    expect(json).not.toContain(greek.name);
    expect(json).not.toContain("2100");
    expect(json).not.toContain("AIzaSy");
  });

  it("пустой день даёт нули", async () => {
    const exported = await buildNutritionExport("2026-09-29");
    expect(exported.nutrition).toEqual({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  });

  it("итоги только запрошенного дня", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });

    const today = await buildNutritionExport("2026-09-29");
    expect(today.nutrition.calories).toBe(0);
  });
});

describe("ai: parseAiSuggestion (клиентская валидация ответа Gemini)", () => {
  it("принимает корректное предложение", () => {
    const parsed = parseAiSuggestion({
      name: "Гречневая каша 250 г",
      calories: 285,
      protein: 10,
      fat: 4,
      carbs: 47,
    });
    expect(parsed.name).toBe("Гречневая каша 250 г");
  });

  it("отклоняет значения вне границ", () => {
    expect(() => parseAiSuggestion({ name: "x", calories: -5, protein: 0, fat: 0, carbs: 0 })).toThrow(AiError);
    expect(() => parseAiSuggestion({ name: "", calories: 100, protein: 0, fat: 0, carbs: 0 })).toThrow(AiError);
  });

  it("отклоняет калории, не согласующиеся с макроэлементами", () => {
    // 10 белка и 50 углеводов дают ~240 ккал; 2000 — абсурд.
    const absurd = { name: "Пирог", calories: 2000, protein: 10, fat: 2, carbs: 50 };
    expect(() => parseAiSuggestion(absurd)).toThrow(/не согласуются/);
    // Тот же sanity check применяется к ручному вводу.
    expect(foodInputSchema.safeParse(absurd).success).toBe(true);
  });
});
