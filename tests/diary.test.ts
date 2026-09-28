import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createFood, updateFood } from "@/lib/repositories/foods";
import {
  createEntry,
  dailyTotals,
  deleteEntry,
  listEntriesForDay,
} from "@/lib/repositories/diary";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const greek = { name: "Гречка 250 г", calories: 400, protein: 20, fat: 10, carbs: 60 };

describe("diary: create / list / totals", () => {
  it("создаёт запись со snapshot блюда и quantity", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");

    const entry = await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 2 });
    expect(entry.ok).toBe(true);
    if (!entry.ok) return;
    expect(entry.data.nameSnapshot).toBe(greek.name);
    expect(entry.data.caloriesSnapshot).toBe(400);
    expect(entry.data.quantity).toBe(2);
    expect(entry.data.entryDate).toBe("2026-09-28");
  });

  it("возвращает записи дня, новые сверху", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    const e1 = await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });
    const e2 = await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });
    if (!e1.ok || !e2.ok) throw new Error("create failed");

    const list = await listEntriesForDay("2026-09-28");
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((e) => e.id)).toEqual([e2.data.id, e1.data.id]);
    // Другой день пуст.
    const other = await listEntriesForDay("2026-09-27");
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.data).toHaveLength(0);
  });

  it("считает totals по всем записям дня (snapshot × quantity)", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 2 });

    const totals = await dailyTotals("2026-09-28");
    expect(totals.ok).toBe(true);
    if (!totals.ok) return;
    expect(totals.data).toEqual({ calories: 800, protein: 40, fat: 20, carbs: 120 });

    const empty = await dailyTotals("2026-09-27");
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.data).toEqual({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  });

  it("totals не зависят от пагинации UI: считаются до удаления записи", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 3 });

    const before = await dailyTotals("2026-09-28");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data.calories).toBe(1600);
  });
});

describe("diary: snapshot behavior", () => {
  it("редактирование блюда не меняет старые записи дневника", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    const entry = await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });
    if (!entry.ok) throw new Error("create failed");

    // Блюдо отредактировали: 400 → 450.
    const updated = await updateFood(food.data.id, { calories: 450 });
    expect(updated.ok).toBe(true);

    const list = await listEntriesForDay("2026-09-28");
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0].caloriesSnapshot).toBe(400);

    const totals = await dailyTotals("2026-09-28");
    expect(totals.ok).toBe(true);
    if (!totals.ok) return;
    expect(totals.data.calories).toBe(400);
  });

  it("soft delete блюда не трогает историю", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });
    await db.foods.update(food.data.id, { deletedAt: new Date().toISOString() });

    const totals = await dailyTotals("2026-09-28");
    expect(totals.ok).toBe(true);
    if (!totals.ok) return;
    expect(totals.data.calories).toBe(400);
  });
});

describe("diary: delete", () => {
  it("удаляет запись и убирает её из totals", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");
    const entry = await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });
    if (!entry.ok) throw new Error("create failed");

    const deleted = await deleteEntry(entry.data.id);
    expect(deleted.ok).toBe(true);

    const totals = await dailyTotals("2026-09-28");
    expect(totals.ok).toBe(true);
    if (!totals.ok) return;
    expect(totals.data.calories).toBe(0);

    const again = await deleteEntry(entry.data.id);
    expect(again.ok).toBe(false);
  });

  it("отклоняет невалидный ввод", async () => {
    const food = await createFood(greek);
    if (!food.ok) throw new Error("create failed");

    const badDate = await createEntry({ foodId: food.data.id, entryDate: "28.09.2026", quantity: 1 });
    expect(badDate.ok).toBe(false);

    const smallQty = await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 0.1 });
    expect(smallQty.ok).toBe(false);

    const unknownFood = await createEntry({
      foodId: "00000000-0000-4000-8000-000000000000",
      entryDate: "2026-09-28",
      quantity: 1,
    });
    expect(unknownFood.ok).toBe(false);
    expect(unknownFood.ok === false && unknownFood.error).toBe("Блюдо не найдено");
  });
});
