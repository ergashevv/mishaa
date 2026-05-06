import ComicCreator from '@/components/ComicCreator';

export const metadata = {
  title: 'Comic Creator',
  description: 'Sequential AI image generation for comic stories.',
};

export default function ComicPage() {
  return (
    <main className="min-h-screen bg-black">
      <ComicCreator />
    </main>
  );
}
