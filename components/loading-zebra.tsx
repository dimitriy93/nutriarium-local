import { hasBrandingImage } from "@/lib/branding";

/**
 * Брендированный loading-state: зебра-«исследователь» + спокойная подпись.
 * Показывается в loading.tsx маршрутов, пока Next.js грузит server-компоненту.
 * Картинка — /branding/zebra-loading.png (временно сгенерированная заглушка,
 * позже заменяется вручную без изменений кода); если файла нет — SVG-зебра.
 */

const captionClass =
  "text-sm font-medium text-[var(--ink-secondary)] animate-pulse";

export default function LoadingZebra({ caption }: { caption: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 pb-24"
    >
      {hasBrandingImage("zebraLoading") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/branding/zebra-loading.png"
          alt=""
          width={120}
          height={120}
          className="size-[120px] animate-pulse rounded-[22%] object-cover"
        />
      ) : (
        <ZebraSvg />
      )}
      <p className={captionClass}>{caption}</p>
    </div>
  );
}

/** Спокойная SVG-зебра — fallback, если zebra-loading.png не положили. */
function ZebraSvg() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className="animate-pulse"
    >
      <ellipse cx="56" cy="78" rx="26" ry="15" fill="#fff" stroke="#3c4148" strokeWidth="2" />
      <path d="M46 66v10M62 66v10" stroke="#3c4148" strokeWidth="5" strokeLinecap="round" />
      <path d="M48 68c3-1 6-1 9 0M58 70c3-1 6-1 9 0" stroke="#3c4148" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="80" cy="52" rx="12" ry="13" fill="#fff" stroke="#3c4148" strokeWidth="2" />
      <path d="M74 40l2 8M82 39l1 8" stroke="#3c4148" strokeWidth="4" strokeLinecap="round" />
      <circle cx="84" cy="50" r="1.8" fill="#1e1e1e" />
      <ellipse cx="89" cy="59" rx="5" ry="3.5" fill="#6e6e73" />
      <path d="M70 44c4-6 10-7 14-5" stroke="#3c4148" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}