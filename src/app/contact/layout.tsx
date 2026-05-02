import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Get in Touch",
  description: "Have questions or feedback? Reach out to the iComics Studio team. We're here to help you create.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
