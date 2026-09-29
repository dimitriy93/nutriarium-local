import { withBase } from "@/lib/base-path";

/**
 * Иллюстрация «данных нет»: /branding/empty.png, если файл есть (клиент
 * получает этот факт через проп hasImage от server component), иначе —
 * gradient placeholder. Спокойный, минималистичный, iOS-style.
 */
export default function EmptyIllustration({
  hasImage,
  caption,
}: {
  hasImage: boolean;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={withBase("/branding/empty.png")}
          alt=""
          width={180}
          height={180}
          className="object-contain opacity-90"
        />
      ) : (
        <div
          aria-hidden="true"
          className="size-[120px] rounded-[36px] bg-gradient-to-br from-[#dff3e7] via-[#ddeafa] to-[#fdefdc] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_rgba(31,41,55,0.06)]"
        />
      )}
      <p className="text-sm text-[var(--ink-secondary)]">{caption}</p>
    </div>
  );
}
