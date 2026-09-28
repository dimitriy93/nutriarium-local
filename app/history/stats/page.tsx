import BottomNav from "@/components/bottom-nav";
import StatsClient from "@/components/stats-client";

/**
 * Статистика истории: графики КБЖУ за 7/30/90 дней. Период и «сегодня» —
 * локальные даты пользователя, данные загружаются из IndexedDB на клиенте.
 */
export default function StatsPage() {
  return (
    <main className="pb-32">
      <StatsClient />
      <BottomNav />
    </main>
  );
}
