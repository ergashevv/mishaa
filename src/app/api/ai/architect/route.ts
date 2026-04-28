import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { storyScript, characters } = await req.json();

    const apiKey = process.env.AZURE_IMAGE_KEY; // Using the same key if it's a unified OpenAI key, or check for GPT key
    const endpoint = process.env.AZURE_IMAGE_ENDPOINT;
    const deployment = process.env.AZURE_GPT_DEPLOYMENT || 'gpt-4o-1';

    if (!apiKey || !endpoint) {
      return NextResponse.json({ error: "AI Logic not configured" }, { status: 500 });
    }

    const systemPrompt = `You are the "Foundry Logic Engine", a professional comic script architect. 
Your task is to transform a story script into a structured JSON array of panels.
Each panel must have:
- prompt: A highly detailed artistic description for an AI image generator (Comic style).
- colSpan: Width (3, 6, 12).
- textElements: An array of dialogue/captions with { text: string, type: 'speech' | 'thought' | 'caption' | 'shout' | 'sfx' }.

Characters available: ${characters.map((c: any) => `${c.name} (${c.description})`).join(', ')}.

Output ONLY valid JSON.`;

    const response = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Synthesize this script into panels: ${storyScript}` }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("GPT Error:", data);
      return NextResponse.json({ error: "AI Synthesis Failed" }, { status: 500 });
    }

    const result = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Architect Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
