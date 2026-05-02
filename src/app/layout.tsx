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
  themeColor: "#020202",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "iComics Studio | AI-Powered Comic Creation",
    template: "%s | iComics Studio",
  },
  description: "The ultimate synthesis environment for independent comic creators. Powering the next generation of visual narrative with AI-driven iComics technology.",
  keywords: ["comics", "AI comics", "comic creation", "manga", "webtoon", "digital art", "iComics", "storytelling", "visual narrative", "AI art"],
  authors: [{ name: "iComics Team", url: "https://icomics.uz" }],
  creator: "iComics Studio",
  publisher: "iComics Studio",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://icomics.uz"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "iComics Studio | Professional Sequential Production",
    description: "The ultimate synthesis environment for independent comic creators. Powering the next generation of visual narrative with AI-driven iComics technology.",
    url: "https://icomics.uz",
    siteName: "iComics Studio",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iComics Studio | AI-Powered Comic Creation",
    description: "The ultimate synthesis environment for independent comic creators. Powering the next generation of visual narrative with AI-driven iComics technology.",
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
};

import SmoothAnimations from "@/components/SmoothAnimations";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${outfit.variable} ${bricolage.variable} ${jetBrainsMono.variable} ${staatliches.variable} ${bangers.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-transparent">
        <SmoothAnimations />
        {children}
      </body>
    </html>
  );
}
