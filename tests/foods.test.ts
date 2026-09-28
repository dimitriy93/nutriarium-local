import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createFood,
  listFoods,
  listRecentFoods,
  searchFoods,
  softDeleteFood,
  updateFood,
} from "@/lib/repositories/foods";
import { createEntry } from "@/lib/repositories/diary";

/** Свежая пустая база на каждый тест. */
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const greek = { name: "Гречневая каша 250 г с молоком", calories: 400, protein: 20, fat: 10, carbs: 60 };
const oat = { name: "Овсяная каша на воде", calories: 250, protein: 10, fat: 5, carbs: 40 };
const chicken = { name: "Куриная грудка гриль 200 г", calories: 330, protein: 62, fat: 4, carbs: 0 };

describe("foods: create / list / search", () => {
  it("создаёт блюдо с полями по умолчанию", async () => {
    const result = await createFood(greek);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBeTruthy();
    expect(result.data.source).toBe("manual");
    expect(result.data.deletedAt).toBeNull();
    expect(result.data.createdAt).toBeTruthy();
  });

  it("создаёт блюдо с source='ai'", async () => {
    const result = await createFood(greek, { source: "ai" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe("ai");
  });

  it("отклоняет невалидные значения", async () => {
    const negative = await createFood({ ...greek, calories: -1 });
    expect(negative.ok).toBe(false);
    const noName = await createFood({ ...greek, name: "   " });
    expect(noName.ok).toBe(false);
  });

  it("возвращает список, отсортированный по названию", async () => {
    await createFood(chicken);
    await createFood(greek);
    await createFood(oat);
    const result = await listFoods();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((f) => f.name)).toEqual([
      "Гречневая каша 250 г с молоком",
      "Куриная грудка гриль 200 г",
      "Овсяная каша на воде",
    ]);
  });

  it("ищет по нескольким словам без учёта регистра", async () => {
    await createFood(greek);
    await createFood(oat);
    await createFood(chicken);

    const one = await searchFoods("каша");
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(one.data).toHaveLength(2);

    const multi = await searchFoods("ГРЕЧНЕВАЯ молоком");
    expect(multi.ok).toBe(true);
    if (!multi.ok) return;
    expect(multi.data).toHaveLength(1);
    expect(multi.data[0].name).toBe(greek.name);

    const none = await searchFoods("пицца");
    expect(none.ok).toBe(true);
    if (!none.ok) return;
    expect(none.data).toHaveLength(0);
  });
});

describe("foods: update / soft delete", () => {
  it("обновляет название и КБЖУ", async () => {
    const created = await createFood(greek);
    if (!created.ok) throw new Error("create failed");
    const updated = await updateFood(created.data.id, { calories: 450, name: "Гречка 250 г" });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.calories).toBe(450);
    expect(updated.data.name).toBe("Гречка 250 г");
    // Ручное редактирование переводит источник в 'manual'.
    const aiFood = await createFood(greek, { source: "ai" });
    if (!aiFood.ok) throw new Error("create failed");
    const edited = await updateFood(aiFood.data.id, { fat: 12 });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.data.source).toBe("manual");
  });

  it("soft delete скрывает блюдо, но записи дневника сохраняют snapshot", async () => {
    const created = await createFood(greek);
    if (!created.ok) throw new Error("create failed");
    const entry = await createEntry({ foodId: created.data.id, entryDate: "2026-09-28", quantity: 1 });
    expect(entry.ok).toBe(true);

    const deleted = await softDeleteFood(created.data.id);
    expect(deleted.ok).toBe(true);

    const list = await listFoods();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(0);

    // Повторный soft delete не удался — блюдо уже удалено.
    const again = await softDeleteFood(created.data.id);
    expect(again.ok).toBe(false);

    // Запись дневника жива.
    const dayEntries = await db.entries.where("entryDate").equals("2026-09-28").toArray();
    expect(dayEntries).toHaveLength(1);
    expect(dayEntries[0].nameSnapshot).toBe(greek.name);
  });
});

describe("foods: recent foods", () => {
  it("возвращает блюда из дневника по дате последнего употребления", async () => {
    const a = await createFood(greek);
    const b = await createFood(oat);
    if (!a.ok || !b.ok) throw new Error("create failed");

    // Нет записей — список последних пуст.
    const empty = await listRecentFoods();
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.data).toHaveLength(0);

    // Паузы дают createdAt записям разные миллисекунды: порядок «последнего
    // употребления» определён по createdAt, а тест создаёт записи подряд.
    await createEntry({ foodId: a.data.id, entryDate: "2026-09-27", quantity: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await createEntry({ foodId: b.data.id, entryDate: "2026-09-28", quantity: 1 });
    await new Promise((r) => setTimeout(r, 5));
    // Повторное употребление более старого блюда поднимает его наверх.
    await createEntry({ foodId: a.data.id, entryDate: "2026-09-29", quantity: 1 });

    const recent = await listRecentFoods(2);
    expect(recent.ok).toBe(true);
    if (!recent.ok) return;
    expect(recent.data.map((f) => f.name)).toEqual([greek.name, oat.name]);
  });
});
