import BottomNav from "@/components/bottom-nav";
import FoodsClient from "@/components/foods-client";
import { hasBrandingImage } from "@/lib/branding";

/**
 * Страница «Блюда». Статический каркас: список, поиск, создание и
 * редактирование выполняются на клиенте напрямую над IndexedDB
 * (см. components/foods-client.tsx).
 */
export default function FoodsPage() {
  return (
    <main className="pb-32">
      <div className="mx-auto w-full max-w-[430px] space-y-5 px-5 pt-[max(env(safe-area-inset-top),48px)]">
        <header className="space-y-1 px-1">
          <h1 className="text-[28px] font-bold tracking-tight">Блюда</h1>
        </header>

        <FoodsClient hasEmptyIllustration={hasBrandingImage("empty")} />
      </div>

      <BottomNav />
    </main>
  );
}
