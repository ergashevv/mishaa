import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Manrope, Bricolage_Grotesque, JetBrains_Mono, Anton, Rubik, Space_Mono } from "next/font/google";
import "./globals.css";
import { getPublicSiteUrl } from "@/lib/og-metadata";
import { ICS_SITE_DISPLAY_NAME } from "@/lib/seo/page-metadata";
import RegionalShell from "@/components/RegionalShell";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import GlobalAgeGate from "@/components/GlobalAgeGate";
import AnalyticsBridge from "@/components/AnalyticsBridge";
import JsonLd from "@/components/JsonLd";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo/global-jsonld";
import LocaleBootstrap from "@/components/LocaleBootstrap";
import SkipToContentLink from "@/components/SkipToContentLink";

const SITE_ORIGIN = getPublicSiteUrl().replace(/\/$/, "");

/* Body / UI sans: Manrope — a famous, modern humanist-geometric grotesque. Cleaner and more
   distinctive than the old Onest; full cyrillic coverage keeps Russian UI on-brand. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

/* Display voice: Bricolage Grotesque — the wordmark face, promoted to headlines/hero. A
   characterful modern grotesque (not another LLM-default serif) that gives the whole site an
   editorial-yet-cinematic tone. Cyrillic headings fall back to Manrope via the --font-display stack. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

/* Mono micro-labels (eyebrows, ratings, kbd): JetBrains Mono — a refined, famous monospace.
   NOTE: Manrope / Bricolage / JetBrains are retained ONLY for Read Mode, which must stay
   identical. The rest of the app (the zine rebuild) uses the three fonts below. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/* ---- ZINE fonts (bold pop / manga-magazine rebuild) ---- */
/* Poster impact type — massive condensed caps for cover-story headlines. */
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});
/* UI + body — Rubik: rounded, friendly, heavy weights, full cyrillic for RU. */
const rubik = Rubik({
  variable: "--font-rubik",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "cyrillic"],
  display: "swap",
});
/* Stamps / tags / meta — Space Mono: quirky monospace, zine-appropriate. */
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

/* Apply the persisted theme AND UI language before first paint. The document renders a
   static lang="en" shell (so the whole app can prerender / CDN-cache); this script flips
   <html data-theme> and <html lang> from storage/cookie before paint, so neither the
   theme nor the language attribute flashes for returning or geo-defaulted visitors. */
const PREPAINT_BOOTSTRAP = `try{var d=document.documentElement;var t=localStorage.getItem("icw-theme");d.dataset.theme=t==="light"?"light":"dark";var l=localStorage.getItem("lang");if(!(l==="en"||l==="ru"||l==="ja"||l==="ko"||l==="zh")){var m=document.cookie.match(/(?:^|; )ics_ui_lang=([^;]+)/);l=m&&decodeURIComponent(m[1])}if(l==="en"||l==="ru"||l==="ja"||l==="ko"||l==="zh"){d.lang=l==="zh"?"zh-Hans":l}}catch(e){}`;

const FONT_VARIABLES = `${manrope.variable} ${bricolage.variable} ${jetbrainsMono.variable} ${anton.variable} ${rubik.variable} ${spaceMono.variable}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFB" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0F" },
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
      "https://superheroapi.com"
    ],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${FONT_VARIABLES} h-full min-h-dvh antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh flex flex-col pb-[env(safe-area-inset-bottom)]">
        <RegionalShell>
          <SkipToContentLink />
          <LocaleBootstrap />
          <GlobalAgeGate />
          <JsonLd data={buildOrganizationJsonLd()} />
          <JsonLd data={buildWebSiteJsonLd()} />
          {/* Skip-link target lives on each page's post-navbar <main id="main-content">,
              not here — this wrapper contains the navbar, so targeting it skips nothing. */}
          <div className="flex-1">
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
