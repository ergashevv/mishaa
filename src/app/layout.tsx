import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Syne, Outfit, Bricolage_Grotesque, JetBrains_Mono, Staatliches, Bangers } from "next/font/google";
import "./globals.css";
import { getPublicSiteUrl } from "@/lib/og-metadata";
import { ICS_SITE_DISPLAY_NAME } from "@/lib/seo/page-metadata";
import SmoothAnimations from "@/components/SmoothAnimations";
import GlobalAgeGate from "@/components/GlobalAgeGate";
import AnalyticsBridge from "@/components/AnalyticsBridge";
import JsonLd from "@/components/JsonLd";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo/global-jsonld";

const SITE_ORIGIN = getPublicSiteUrl().replace(/\/$/, "");

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

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

const staatliches = Staatliches({
  variable: "--font-staatliches",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const bangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  weight: "400",
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
    "Read manga, manhwa, comics, and adult hentai online. Free library for readers: webtoons, Marvel, indie series, and multi-source chapters. Optional AI comic studio for creators.",
  keywords: [
    "read manga online",
    "manga reader",
    "manhwa",
    "webtoon",
    "comics",
    "hentai",
    "adult manga",
    "digital comic library",
    "free comic reader",
    "Marvel comics",
    "iComics.wiki",
  ],
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
    title: ICS_SITE_DISPLAY_NAME,
    description:
      "Online manga, manhwa, comic, and hentai reader. Browse and read chapters free. Webtoons, Marvel, and more—plus optional AI tools for creators.",
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
    title: `${ICS_SITE_DISPLAY_NAME} — Manga, Manhwa & Comic Reader`,
    description:
      "Read manga, manhwa, comics, and adult titles online. A reader-first library with webtoons, Marvel, and hentai-capable catalog.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${outfit.variable} ${bricolage.variable} ${jetBrainsMono.variable} ${staatliches.variable} ${bangers.variable} h-full min-h-dvh antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-transparent pb-[env(safe-area-inset-bottom)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only fixed left-4 top-4 z-[99999] rounded-xl bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-black"
        >
          Skip to content
        </a>
        <SmoothAnimations />
        <GlobalAgeGate />
        <JsonLd data={buildOrganizationJsonLd()} />
        <JsonLd data={buildWebSiteJsonLd()} />
        <div id="main-content" className="flex-1">
          <Suspense fallback={null}>
            <AnalyticsBridge />
          </Suspense>
          {children}
        </div>
      </body>
    </html>
  );
}
