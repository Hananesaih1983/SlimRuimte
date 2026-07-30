import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SlimRuimte",
  description:
    "Scan je ruimte, zie je verbouwing en vind de juiste aannemer of ontwerper.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SlimRuimte",
  },
  // Chrome warns on the apple-prefixed tag `appleWebApp` emits and wants the
  // standardised name too; iOS Safari only understands the apple one.
  other: { "mobile-web-app-capable": "yes" },
  // No `icons` key on purpose: `src/app/icon.png` and `src/app/apple-icon.png`
  // are file conventions and already emit the tags. Setting `icons` here would
  // override them and pin URLs that the build hashes.
};

// Next 16 rejects `themeColor` on the metadata object — it belongs to viewport.
export const viewport: Viewport = {
  themeColor: "#18181b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Locale, messages and formats are inherited from src/i18n/request.ts */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
