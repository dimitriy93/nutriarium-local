import { beforeEach, describe, expect, it } from "vitest";
import { db, SETTINGS_KEYS } from "@/lib/db";
import { DEFAULT_GOALS } from "@/lib/diary";
import {
  getGoals,
  getProfile,
  getAiApiKey,
  saveAiApiKey,
  clearAiApiKey,
  saveGoals,
  saveProfile,
} from "@/lib/repositories/settings";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("settings: goals", () => {
  it("возвращает дефолты на пустой базе", async () => {
    const goals = await getGoals();
    expect(goals).toEqual(DEFAULT_GOALS);
  });

  it("сохраняет и читает цели", async () => {
    const saved = await saveGoals({ calories: 1800, protein: 130, fat: 60, carbs: 200 });
    expect(saved.ok).toBe(true);
    expect(await getGoals()).toEqual({ calories: 1800, protein: 130, fat: 60, carbs: 200 });
  });

  it("нулевые/отсутствующие значения заменяются дефолтами", async () => {
    await saveGoals({ calories: 0, protein: 130, fat: 0, carbs: 200 });
    const goals = await getGoals();
    expect(goals.calories).toBe(DEFAULT_GOALS.calories);
    expect(goals.protein).toBe(130);
  });
});

describe("settings: profile", () => {
  it("имя по умолчанию пустое", async () => {
    expect((await getProfile()).displayName).toBe("");
  });

  it("сохраняет имя и цели одной формой", async () => {
    const result = await saveProfile({
      displayName: "Артём",
      calorieGoal: 2200,
      proteinGoal: 140,
      fatGoal: 70,
      carbsGoal: 250,
    });
    expect(result.ok).toBe(true);
    expect((await getProfile()).displayName).toBe("Артём");
    expect(await getGoals()).toEqual({ calories: 2200, protein: 140, fat: 70, carbs: 250 });
  });

  it("валидирует форму (пустое имя, неположительные цели)", async () => {
    const noName = await saveProfile({
      displayName: "  ",
      calorieGoal: 2000,
      proteinGoal: 120,
      fatGoal: 70,
      carbsGoal: 250,
    });
    expect(noName.ok).toBe(false);

    const zeroGoal = await saveProfile({
      displayName: "Артём",
      calorieGoal: 0,
      proteinGoal: 120,
      fatGoal: 70,
      carbsGoal: 250,
    });
    expect(zeroGoal.ok).toBe(false);
  });
});

describe("settings: ai api key", () => {
  it("ключ не настроен по умолчанию", async () => {
    expect(await getAiApiKey()).toBeNull();
  });

  it("сохраняет, читает и удаляет ключ", async () => {
    const saved = await saveAiApiKey("  AIzaSyTest1234567890  ");
    expect(saved.ok).toBe(true);
    expect(await getAiApiKey()).toBe("AIzaSyTest1234567890");

    const cleared = await clearAiApiKey();
    expect(cleared.ok).toBe(true);
    expect(await getAiApiKey()).toBeNull();
    // Запись settings удалена, а не обнулена.
    expect(await db.settings.get(SETTINGS_KEYS.ai)).toBeUndefined();
  });

  it("перезаписывает сохранённый ключ новым", async () => {
    await saveAiApiKey("AIzaSyOld111111111111");
    await saveAiApiKey("AIzaSyNew222222222222");
    expect(await getAiApiKey()).toBe("AIzaSyNew222222222222");
  });

  it("отклоняет пустой ключ и ключ с переносами строк", async () => {
    expect((await saveAiApiKey("   ")).ok).toBe(false);
    expect((await saveAiApiKey("key\nwith\nnewlines")).ok).toBe(false);
  });
});
