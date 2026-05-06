import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about iComics.wiki and our mission to empower independent comic creators with cutting-edge AI technology.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
