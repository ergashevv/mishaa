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

export const metadata: Metadata = {
  title: "iComics Studio | Professional Sequential Production",
  description: "The ultimate synthesis environment for independent comic creators. Powering the next generation of visual narrative with iComics.",
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
      <body className="min-h-full flex flex-col bg-[#fcfaf2]">
        <SmoothAnimations />
        {children}
      </body>
    </html>
  );
}

