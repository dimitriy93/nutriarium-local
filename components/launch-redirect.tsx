"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Клиентский редирект с «пусковой» страницы `/` на /diary.
 *
 * Зачем: WebKit в standalone-режиме (установленный iOS PWA) ненадёжно
 * обрабатывает HTTP-редирект самого первого документа — launch на start_url
 * с 307 (например, /diary → /login без сессии) даёт белый экран. Поэтому
 * manifest.start_url = "/" рендерит настоящий документ с loader-зеброй, а
 * переход выполняется уже внутри клиентской навигации Next.js, где redirect()
 * из server-компоненты обрабатывается штатно.
 */
export default function LaunchRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/diary");
  }, [router]);

  return null;
}