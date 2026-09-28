import { beforeEach, describe, expect, it } from "vitest";
import { db, SETTINGS_KEYS } from "@/lib/db";
import { DEFAULT_GOALS } from "@/lib/diary";
import {
  getGoals,
  getProfile,
  getAiSettings,
  saveAiSettings,
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

describe("settings: ai proxy", () => {
  it("AI не настроен по умолчанию", async () => {
    expect(await getAiSettings()).toBeNull();
  });

  it("сохраняет и читает адрес прокси", async () => {
    const result = await saveAiSettings({ proxyUrl: "https://nutriarium-ai.example.workers.dev" });
    expect(result.ok).toBe(true);
    const ai = await getAiSettings();
    expect(ai?.proxyUrl).toBe("https://nutriarium-ai.example.workers.dev");
    expect(JSON.stringify(await db.settings.get(SETTINGS_KEYS.ai))).not.toMatch(/key=/i);
  });

  it("отклоняет http и URL с ключом", async () => {
    const http = await saveAiSettings({ proxyUrl: "http://insecure.example.com" });
    expect(http.ok).toBe(false);

    const withKey = await saveAiSettings({
      proxyUrl: "https://example.com?key=SECRET",
    });
    expect(withKey.ok).toBe(false);
  });
});
