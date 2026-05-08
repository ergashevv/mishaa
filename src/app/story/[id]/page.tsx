import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CinematicViewer from "@/components/CinematicViewer";
import { getPublicSiteUrl } from "@/lib/og-metadata";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const story = await prisma.story.findUnique({
    where: { id },
    select: { title: true, globalContext: true, status: true },
  });

  if (!story) {
    return { title: "Story | iComics.wiki" };
  }

  const site = getPublicSiteUrl().replace(/\/$/, "");
  const titleText = story.title?.trim() || "Untitled story";
  const draft =
    !story.status || story.status.toLowerCase() === "draft";

  const description =
    story.globalContext?.replace(/\s+/g, " ").trim().slice(0, 160) ||
    `Read "${titleText}" — a cinematic comic story on iComics.wiki.`;

  const canonical = `${site}/story/${id}`;

  return {
    title: titleText,
    description,
    alternates: { canonical },
    openGraph: {
      title: titleText,
      description,
      url: canonical,
      siteName: "iComics.wiki",
      type: "article",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description,
    },
    ...(draft ? { robots: { index: false, follow: false } as const } : {}),
  };
}

export default async function PublicStoryPage({ params }: Props) {
  const { id } = await params;
  const story = await prisma.story.findUnique({
    where: { id },
    include: { frames: { orderBy: { position: 'asc' } } },
  });

  if (!story) notFound();

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black">
      <CinematicViewer story={story} />
    </main>
  );
}
