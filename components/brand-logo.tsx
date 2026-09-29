import { withBase } from "@/lib/base-path";

/**
 * Логотип Nutriarium. Если /branding/logo.png существует — показывается он,
 * иначе аккуратный gradient placeholder с буквой «N» (iOS-style, спокойный).
 */
export default function BrandLogo({ hasImage, size = 72 }: { hasImage: boolean; size?: number }) {
  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={withBase("/branding/logo.png")}
        alt="Логотип Nutriarium"
        width={size}
        height={size}
        className="rounded-[22%] object-cover shadow-[0_8px_24px_rgba(31,41,55,0.12)]"
      />
    );
  }

  return (
    <div
      aria-label="Логотип Nutriarium"
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-[22%] bg-gradient-to-br from-[#7fd8b2] via-[#34c78f] to-[#5b9bf0] text-white shadow-[0_8px_24px_rgba(52,199,143,0.35)]"
    >
      <span
        className="font-bold tracking-tight"
        style={{ fontSize: Math.round(size * 0.44) }}
      >
        N
      </span>
    </div>
  );
}
