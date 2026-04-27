import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CinematicViewer from "@/components/CinematicViewer";

export default async function PublicStoryPage({ params }: { params: { id: string } }) {
  const story = await prisma.story.findUnique({
    where: { id: params.id },
    include: { frames: { orderBy: { position: 'asc' } } },
  });

  if (!story) notFound();

  return (
    <main className="min-h-screen bg-black">
      <CinematicViewer story={story} />
    </main>
  );
}
