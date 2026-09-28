"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/diary", label: "Дневник", icon: BookIcon },
  { href: "/history", label: "История", icon: ClockIcon },
  { href: "/foods", label: "Блюда", icon: LeafIcon },
  { href: "/settings", label: "Настройки", icon: GearIcon },
] as const;

/**
 * Нижняя плавающая навигация (liquid glass): фиксируется внизу с учётом
 * safe-area, активная вкладка — круглая светлая кнопка с акцентной иконкой.
 */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),16px)]"
    >
      <div className="glass-nav flex w-full max-w-[400px] items-stretch gap-0.5 rounded-[26px] p-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-[21px] px-2 py-2 transition-all duration-200 active:scale-[0.94] " +
                (active
                  ? "bg-[var(--accent)] text-white shadow-[0_6px_18px_rgba(52,199,143,0.4)]"
                  : "text-[var(--ink-secondary)]")
              }
            >
              <Icon active={active} />
              <span className="text-[10px] leading-none font-semibold">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "rgba(255,255,255,0.25)" : "none"}
      />
      <path
        d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LeafIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 19C5 10 11 5 20 4c1 9-4 15-13 15h-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "rgba(255,255,255,0.25)" : "none"}
      />
      <path d="M5 19c3-5 7-8 11-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "rgba(255,255,255,0.25)" : "none"}
      />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="3.2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "rgba(255,255,255,0.25)" : "none"}
      />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
