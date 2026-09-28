import type { Metadata, Viewport } from "next";
import ServiceWorkerRegistrar from "@/components/service-worker-registrar";
import { withBase } from "@/lib/base-path";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nutriarium",
  description: "Локальный учёт питания",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Nutriarium" },
  manifest: withBase("/manifest.webmanifest"),
  icons: {
    // apple-touch-icon: скругление применяет iOS; остальные — PWA/фавиконки.
    apple: [{ url: withBase("/apple-touch-icon.png"), sizes: "180x180" }],
    icon: [
      { url: withBase("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withBase("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
  },
};

// viewport-fit=cover — обязателен для env(safe-area-inset-*) на iPhone.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#f4f6f8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
