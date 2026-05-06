import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Gallery",
  description: "Explore the latest creations from our AI comic generator. A showcase of visual narratives and digital art.",
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
