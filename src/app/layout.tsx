import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { Outfit, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getPublicSiteUrl } from "@/lib/og-metadata";
import { ICS_SITE_DISPLAY_NAME } from "@/lib/seo/page-metadata";
import SmoothAnimations from "@/components/SmoothAnimations";
import RegionalShell from "@/components/RegionalShell";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import GlobalAgeGate from "@/components/GlobalAgeGate";
import AnalyticsBridge from "@/components/AnalyticsBridge";
import JsonLd from "@/components/JsonLd";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo/global-jsonld";
import { readRegionSignalsFromHeaders } from "@/lib/regional/geo-headers";
import { translations } from "@/lib/translations";
import { isUiLang } from "@/lib/i18n/lang";
import LocaleBootstrap from "@/components/LocaleBootstrap";
import { UI_LANG_COOKIE } from "@/lib/i18n/cookies";

function htmlLangFromUiCookie(value: string | undefined): string {
  if (!isUiLang(value)) return "en";
  if (value === "zh") return "zh-Hans";
  return value;
}

const SITE_ORIGIN = getPublicSiteUrl().replace(/\/$/, "");

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#090a0f" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: ICS_SITE_DISPLAY_NAME,
    template: `%s | ${ICS_SITE_DISPLAY_NAME}`,
  },
    description:
      'Manga, hentai & manhwa online—search Japanese, Korean, Chinese, English & Russian (romanization OK). MangaDex-style browser library. icomics.wiki; not MangaDex.org.',
  authors: [{ name: `${ICS_SITE_DISPLAY_NAME} Team`, url: SITE_ORIGIN }],
  creator: ICS_SITE_DISPLAY_NAME,
  publisher: ICS_SITE_DISPLAY_NAME,
  metadataBase: new URL(SITE_ORIGIN),
  alternates: {
    canonical: SITE_ORIGIN,
    /** Primary page language; same URL for all regions (no hreflang per-locale variants yet). */
    languages: {
      en: SITE_ORIGIN,
      'x-default': SITE_ORIGIN,
    },
    types: {
      "application/rss+xml": `${SITE_ORIGIN}/feed.xml`,
    },
  },
  openGraph: {
    title: `Manga, hentai & manhwa online — ${ICS_SITE_DISPLAY_NAME}`,
    description:
      "Read manga, hentai & manhwa in-browser—MangaDex-style library, age‑gated shelves, FAQs. icomics.wiki (independent site; not MangaDex.org).",
    url: SITE_ORIGIN,
    siteName: ICS_SITE_DISPLAY_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${SITE_ORIGIN}/logo.png`,
        width: 512,
        height: 512,
        alt: `${ICS_SITE_DISPLAY_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Manga, hentai & manhwa — MangaDex-style online reader",
    description:
      "Manga, hentai & manhwa in your browser; MangaDex-style search & chapters. Age‑verified adult content. icomics.wiki—not MangaDex official.",
    images: [`${SITE_ORIGIN}/logo.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "Q3JUtRB_65-cXXd1FocDiCQ-Y4bOA_zmDpzJQfhU9mE",
  },
  icons: {
    icon: [
      { url: '/icon.png' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon.png',
  },
  other: {
    "dns-prefetch": [
      "https://api.mangadex.org",
      "https://uploads.mangadex.org",
      "https://marvel.emreparker.com",
      "https://archive.org",
      "https://superheroapi.com"
    ],
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hdrs = await headers();
  const { analyticsConsentRequired, eastAsiaAgeCopy, europeAgeCopy } = readRegionSignalsFromHeaders(hdrs);
  const cookieStore = await cookies();
  const htmlLang = htmlLangFromUiCookie(cookieStore.get(UI_LANG_COOKIE)?.value);
  const uiForCopy = cookieStore.get(UI_LANG_COOKIE)?.value;
  const copyLang = isUiLang(uiForCopy) ? uiForCopy : "en";
  const skipToContentLabel = translations[copyLang].common.skipToContent;

  return (
    <html
      lang={htmlLang}
      className={`${outfit.variable} ${bricolage.variable} ${jetBrainsMono.variable} h-full min-h-dvh antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-transparent pb-[env(safe-area-inset-bottom)]">
        <RegionalShell
          analyticsConsentRequired={analyticsConsentRequired}
          eastAsiaAgeCopy={eastAsiaAgeCopy}
          europeAgeCopy={europeAgeCopy}
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only fixed left-4 top-4 z-[99999] rounded-xl bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-black"
          >
            {skipToContentLabel}
          </a>
          <SmoothAnimations />
          <LocaleBootstrap />
          <GlobalAgeGate />
          <JsonLd data={buildOrganizationJsonLd()} />
          <JsonLd data={buildWebSiteJsonLd()} />
          <div id="main-content" className="flex-1">
            <Suspense fallback={null}>
              <AnalyticsBridge />
            </Suspense>
            {children}
          </div>
          <CookieConsentBanner />
        </RegionalShell>
      </body>
    </html>
  );
}
