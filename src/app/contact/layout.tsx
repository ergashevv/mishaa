import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Have questions or feedback? Reach out to the iComics.wiki team. We're here to help you create.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
