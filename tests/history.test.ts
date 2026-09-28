import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createFood } from "@/lib/repositories/foods";
import { createEntry } from "@/lib/repositories/diary";
import { getStats, listDayTotals } from "@/lib/repositories/history";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("history: listDayTotals", () => {
  it("агрегирует итоги по дням, новые сверху", async () => {
    const food = await createFood({ name: "Гречка", calories: 400, protein: 20, fat: 10, carbs: 60 });
    if (!food.ok) throw new Error("create failed");
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-27", quantity: 1 });
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 2 });

    const result = await listDayTotals();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((d) => d.date)).toEqual(["2026-09-28", "2026-09-27"]);
    expect(result.data[0].calories).toBe(800);
    expect(result.data[1].calories).toBe(400);
  });
});

describe("history: getStats", () => {
  it("включает сегодня в непрерывный ряд (дни без записей — нули)", async () => {
    const food = await createFood({ name: "Гречка", calories: 400, protein: 20, fat: 10, carbs: 60 });
    if (!food.ok) throw new Error("create failed");
    // Запись только за последний день периода — 7-дневный ряд должен её учесть.
    await createEntry({ foodId: food.data.id, entryDate: "2026-09-28", quantity: 1 });

    const result = await getStats("2026-09-22", "2026-09-28");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.days).toHaveLength(7);
    expect(result.data.days[0].date).toBe("2026-09-22");
    // Последний день периода — «сегодня» — не теряется.
    expect(result.data.days[6].date).toBe("2026-09-28");
    expect(result.data.days[6].calories).toBe(400);
    // Промежуточные дни — нули.
    expect(result.data.days[3].calories).toBe(0);

    // Среднее за период считается по всем 7 дням.
    const avg = result.data.days.reduce((a, d) => a + d.calories, 0) / 7;
    expect(Math.round(avg)).toBe(57);
  });

  it("возвращает цели с дефолтами на пустой базе", async () => {
    const result = await getStats("2026-09-22", "2026-09-28");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.goals.calories).toBe(2000);
  });
});
