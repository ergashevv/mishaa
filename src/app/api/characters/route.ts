import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    const where = session ? { userId: session.id } : { userId: null };

    const characters = await prisma.character.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(characters || []);
  } catch (error: unknown) {
    console.error("Characters GET Error:", error);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const { name, role, description, imageUrl } = await req.json();

    const character = await prisma.character.create({
      data: {
        name,
        role,
        description,
        imageUrl,
        userId: session?.id || null,
      },
    });

    return NextResponse.json(character);
  } catch (error: unknown) {
    console.error("Characters POST Error:", error);
    return NextResponse.json({ error: "Failed to save character." }, { status: 500 });
  }
}
