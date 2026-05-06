import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comic Library",
  description: "Browse our extensive collection of comics, manga, manhwa, and webtoons. From Marvel classics to independent Japanese narratives.",
};

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
