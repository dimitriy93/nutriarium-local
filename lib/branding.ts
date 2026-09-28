/**
 * Брендинговые изображения. В статической сборке проверять наличие файла
 * через node:fs нельзя (server-only), поэтому наличие фиксировано на этапе
 * сборки: все файлы из /public/branding копируются в репозиторий. Чтобы
 * скрыть изображение — достаточно удалить файл из public/branding и
 * переключить флаг здесь.
 */
const BRANDING_FILES = {
  avatar: true,
  empty: true,
  logo: true,
  zebraLoading: true,
} as const;

export type BrandingFile = keyof typeof BRANDING_FILES;

export function hasBrandingImage(file: BrandingFile): boolean {
  return BRANDING_FILES[file];
}
