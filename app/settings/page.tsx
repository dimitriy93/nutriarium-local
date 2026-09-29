import BottomNav from "@/components/bottom-nav";
import SettingsClient from "@/components/settings-client";

/**
 * Настройки local-first версии: профиль, цели и AI-ключ (IndexedDB).
 * Раздел «Аккаунт» из прежней версии удалён вместе с авторизацией.
 */
export default function SettingsPage() {
  return (
    <main className="pb-32">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] space-y-6 px-5 pt-[max(env(safe-area-inset-top),48px)] pb-16">
        <header className="space-y-1 px-1">
          <h1 className="text-[28px] font-bold tracking-tight">Настройки</h1>
        </header>

        <SettingsClient />
      </div>

      <BottomNav />
    </main>
  );
}
