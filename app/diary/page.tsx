import BottomNav from "@/components/bottom-nav";
import DiaryClient from "@/components/diary-client";
import { hasBrandingImage } from "@/lib/branding";

/**
 * Дневник питания — главный экран приложения. Открытие без авторизации:
 * local-first приложение всегда начинает с локального дневника.
 * Все данные дневника клиент загружает из IndexedDB (локальная дата
 * пользователя известна только на клиенте).
 */
export default function DiaryPage() {
  return (
    <main className="pb-32">
      <DiaryClient hasEmptyIllustration={hasBrandingImage("empty")} />
      <BottomNav />
    </main>
  );
}
