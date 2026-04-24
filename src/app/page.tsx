import StoryViewer from '@/components/StoryViewer';

export const metadata = {
  title: 'My Story | Bro Please',
  description: 'A cinematic journey of my current financial situation.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <StoryViewer />
    </main>
  );
}
