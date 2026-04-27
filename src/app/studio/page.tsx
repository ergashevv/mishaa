import ComicCreator from '@/components/ComicCreator';
import Navbar from '@/components/Navbar';

export default function StudioPage() {
  return (
    <div className="min-h-screen bg-[#080808]">
      <Navbar />
      <div className="pt-24 pb-20">
        <ComicCreator />
      </div>
    </div>
  );
}
