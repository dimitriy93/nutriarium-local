import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createFood, softDeleteFood } from "@/lib/repositories/foods";
import { createEntry } from "@/lib/repositories/diary";
import { saveGoals } from "@/lib/repositories/settings";
import { buildExport, EXPORT_SCHEMA_VERSION } from "@/lib/export/export";
import { foodInputSchema } from "@/lib/validation";
import { parseAiSuggestion } from "@/lib/ai/estimate";
import { AiError } from "@/lib/ai/estimate";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const greek = { name: "Гречка 250 г", calories: 400, protein: 20, fat: 10, carbs: 60 };
const oat = { name: "Овсянка", calories: 250, protein: 10, fat: 5, carbs: 40 };

describe("export: buildExport", () => {
  it("формирует версионируемый JSON со всеми данными", async () => {
    const food = await createFood(greek, { source: "ai" });
    if (!food.ok) throw new Error("create failed");
    await createFood(oat);
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 2 });
    await saveGoals({ calories: 2100, protein: 130, fat: 65, carbs: 240 });

    const exported = await buildExport();

    expect(exported.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(EXPORT_SCHEMA_VERSION).toBe(1);
    expect(exported.source).toBe("nutriarium");
    expect(new Date(exported.exportedAt).toString()).not.toBe("Invalid Date");

    // Entries: только контрактные поля, без внутренних ключей IndexedDB.
    expect(exported.data.entries).toEqual([
      {
        date: "2026-09-28",
        name: greek.name,
        calories: 400,
        protein: 20,
        fat: 10,
        carbs: 60,
        quantity: 2,
        createdAt: expect.any(String),
      },
    ]);

    // Foods: только активные (soft-deleted не экспортируются).
    await softDeleteFood(food.data.id);
    const afterDelete = await buildExport();
    expect(afterDelete.data.foods.map((f) => f.name)).toEqual([oat.name]);
    // Запись дневника сохраняется со своим snapshot.
    expect(afterDelete.data.entries).toHaveLength(1);

    // Goals.
    expect(exported.data.goals).toEqual({
      calories: 2100,
      protein: 130,
      fat: 65,
      carbs: 240,
    });

    // JSON-сериализуемость (для clipboard).
    expect(() => JSON.stringify(exported)).not.toThrow();
  });

  it("пустая база даёт валидный пустой экспорт", async () => {
    const exported = await buildExport();
    expect(exported.data.entries).toEqual([]);
    expect(exported.data.foods).toEqual([]);
    expect(exported.data.goals.calories).toBeGreaterThan(0);
  });
});

describe("ai: parseAiSuggestion (клиентская валидация ответа proxy)", () => {
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
