import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { images } = await req.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "Missing images" }, { status: 400 });
    }

    const apiKey = process.env.AZURE_IMAGE_KEY;
    const endpoint = process.env.AZURE_IMAGE_ENDPOINT;
    const gptDeployment = process.env.AZURE_GPT_DEPLOYMENT || "gpt-4o";

    if (!apiKey || !endpoint) {
      return NextResponse.json({ error: "Azure API configuration missing" }, { status: 500 });
    }

    // Output a FICTIONAL COMIC BOOK CHARACTER description — NOT a real person description.
    // This is critical: Azure's image generation will blur faces if the prompt sounds like
    // a real person. By describing a "comic book character", the output stays illustrated.
    const prompt = `You are a professional comic book character designer. 
Analyze the reference photo and create a FICTIONAL COMIC BOOK CHARACTER visual description for AI image generation.

This description will be used to draw an ILLUSTRATED, FICTIONAL comic character — not to recreate a real person photo.

Write ONE concise description (max 80 words) in this format:
"A [adjective] comic book character with [hair color/style], [eye color/description], [notable facial features like jawline/face shape], [skin tone], wearing [clothing/costume style description]. Drawn in comic illustration style."

Rules:
- Say "comic book character" or "illustrated hero/villain" — NEVER say "person", "man", "woman", "real person"
- Focus on: hair, eyes, distinctive features, costume — things useful for comic art consistency
- Add one personality/archetype hint (e.g. "brooding vigilante look", "fierce warrior stance")
- Keep it artistic and fictional

Return ONLY the description. No extra text.`;

    const baseUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
    const url = `${baseUrl}/openai/deployments/${gptDeployment}/chat/completions?api-version=2024-02-15-preview`;

    const messageContent = [
      { type: "text", text: prompt },
      ...images.map((img: string) => ({
        type: "image_url",
        image_url: { url: img.startsWith("data:") ? img : `data:image/png;base64,${img}` },
      })),
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: messageContent }],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Azure GPT request failed", details: errorData },
        { status: response.status }
      );
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";

    // Ensure final description has comic-book language
    const sanitized = text
      .replace(/\breal person\b/gi, "comic character")
      .replace(/\bphotograph\b/gi, "illustration")
      .trim();

    return NextResponse.json({ description: sanitized });
  } catch (error: unknown) {
    console.error("describe-character error:", error);
    const message = error instanceof Error ? error.message : "Character description failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
