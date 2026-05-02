export const runtime = "edge";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { context, characters, currentPrompt } = await req.json();

    const apiKey = process.env.AZURE_IMAGE_KEY;
    const endpoint = process.env.AZURE_IMAGE_ENDPOINT;
    const deployment = process.env.AZURE_GPT_DEPLOYMENT || 'gpt-4o-1';

    if (!apiKey || !endpoint) {
      return NextResponse.json({ error: "AI Suggestion not configured" }, { status: 500 });
    }

    const systemPrompt = `You are a professional comic panel director. 
Suggest a highly detailed and cinematic visual prompt for a single panel based on the context and characters provided.
Characters: ${characters.map((c: any) => `${c.name} (${c.description})`).join(', ')}.
Existing prompt: ${currentPrompt || 'None'}.
Context: ${context || 'General comic scene'}.

The suggestion should be a single paragraph of descriptive text focusing on lighting, camera angle, and character emotion.
Output ONLY the suggestion text, no other formatting.`;

    const response = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Suggest a visual prompt for this panel.` }
        ],
        temperature: 0.8
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ error: "AI Suggestion Failed" }, { status: 500 });
    }

    const suggestion = data.choices[0].message.content;
    return NextResponse.json({ suggestion });

  } catch (error) {
    console.error("Suggestion Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
