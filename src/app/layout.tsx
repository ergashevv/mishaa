import type { Metadata } from "next";
import { Syne, Outfit, Bricolage_Grotesque, JetBrains_Mono, Staatliches, Bangers } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const staatliches = Staatliches({
  variable: "--font-staatliches",
  subsets: ["latin"],
  weight: "400",
});

const bangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  weight: "400",
});

export const viewport = {
  themeColor: "#06070b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "iComics.wiki",
    template: "%s | iComics.wiki",
  },
  description: "AI-powered comic creation and a digital comic library for manga, manhwa, Marvel, and webtoon readers.",
  keywords: ["comics", "AI comics", "comic creation", "manga", "webtoon", "digital art", "iComics.wiki", "storytelling", "visual narrative", "AI art"],
  authors: [{ name: "iComics.wiki Team", url: "https://icomics.wiki" }],
  creator: "iComics.wiki",
  publisher: "iComics.wiki",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://icomics.wiki"),
  alternates: {
    canonical: "https://icomics.wiki",
    languages: {
      "en-US": "https://icomics.wiki/en",
      "ru-RU": "https://icomics.wiki/ru",
      "es-ES": "https://icomics.wiki/es",
      "fr-FR": "https://icomics.wiki/fr",
    },
  },
  openGraph: {
    title: "iComics.wiki",
    description: "AI-powered comic creation and a digital comic library for manga, manhwa, Marvel, and webtoon readers.",
    url: "https://icomics.wiki",
    siteName: "iComics.wiki",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iComics.wiki",
    description: "AI-powered comic creation and a digital comic library for manga, manhwa, Marvel, and webtoon readers.",
    creator: "@icomics_studio",
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
      { url: '/logo.png' },
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/logo.png',
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

import SmoothAnimations from "@/components/SmoothAnimations";
import GlobalAgeGate from "@/components/GlobalAgeGate";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${outfit.variable} ${bricolage.variable} ${jetBrainsMono.variable} ${staatliches.variable} ${bangers.variable} h-full antialiased bg-[#06070b]`}
    >
      <body className="min-h-full flex flex-col bg-transparent pb-[env(safe-area-inset-bottom)]">
        <SmoothAnimations />
        <GlobalAgeGate />
        {children}
      </body>
    </html>
  );
}
