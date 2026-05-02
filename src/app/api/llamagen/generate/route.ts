export const runtime = "edge";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, character, preset } = await req.json();
    const apiKey = process.env.LLAMAGEN_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "LlamaGen API Key not configured" }, { status: 500 });
    }

    // Prepare character identity for consistency if available
    const comicRoles = character ? [{
      roleName: character.name,
      roleDescription: character.description,
      faceImageUrl: character.imageUrl
    }] : [];

    const response = await fetch('https://api.llamagen.ai/v1/comics/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        preset: preset || "Digital Painting",
        size: "1024x1024",
        comicRoles: comicRoles,
        fixPanelNum: 1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("LlamaGen API Error:", data);
      return NextResponse.json({ error: data.message || "Failed to generate image" }, { status: response.status });
    }

    // LlamaGen returns an ID for async generation, we should poll or it might return the result directly depending on the endpoint
    // According to the search, it returns an ID.
    return NextResponse.json(data);
  } catch (error) {
    console.error("Internal Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
