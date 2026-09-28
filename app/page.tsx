import LaunchRedirect from "@/components/launch-redirect";
import LoadingZebra from "@/components/loading-zebra";

/**
 * Пусковая страница (manifest start_url). Никакого серверного redirect():
 * WebKit в standalone-режиме iOS даёт белый экран, когда самый первый
 * документ launch'а — HTTP-редирект. Рендерим настоящий документ с зеброй
 * и уходим на /diary на клиенте.
 */
export default function HomePage() {
  return (
    <main>
      <LaunchRedirect />
      <LoadingZebra caption="Зебра готовит дневник…" />
    </main>
  );
}
