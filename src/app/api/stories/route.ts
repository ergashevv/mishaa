import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // Single Story Mode
    if (id) {
      const story = await prisma.story.findUnique({
        where: { id },
        include: { frames: true }
      });
      return NextResponse.json(story);
    }

    // List Mode
    const where = session ? { userId: session.id } : { userId: null };
    const stories = await prisma.story.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(stories);
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed to load stories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const data = await req.json();
    const { id, title, content, status } = data;

    if (id) {
      // Update existing story
      const existing = await prisma.story.findUnique({ where: { id } });
      if (existing?.userId && existing.userId !== session?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const updated = await prisma.story.update({
        where: { id },
        data: {
          title: title || existing?.title,
          content: content || existing?.content,
          status: status || existing?.status,
        }
      });
      return NextResponse.json(updated);
    }

    // Create new story
    const story = await prisma.story.create({
      data: {
        title: title || 'Untitled Masterpiece',
        content: content || {},
        status: status || 'draft',
        userId: session?.id || null,
      }
    });

    return NextResponse.json(story);
  } catch (error: unknown) {
    console.error("Story Save Error:", error);
    return NextResponse.json({ error: "Failed to save to cloud" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const story = await prisma.story.findUnique({ where: { id } });
    if (story?.userId && story.userId !== session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.story.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed to delete story" }, { status: 500 });
  }
}
