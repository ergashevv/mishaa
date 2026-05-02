export const runtime = "edge";
import { Metadata } from "next";
import ComicCreator from '@/components/ComicCreator';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: "Creative Studio | AI Comic Generator",
  description: "Create your own comics with our AI-powered generation tools. Professional sequential production environment for creators.",
};

export default function StudioPage() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <Navbar />
      <div className="pt-24 pb-20">
        <ComicCreator />
      </div>
    </div>
  );
}
