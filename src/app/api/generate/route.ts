export const runtime = "edge";
import { NextResponse } from "next/server";


export async function POST(req: Request) {
  try {
    const { prompt: userPrompt } = await req.json();
    const apiKey = process.env.AZURE_IMAGE_KEY;
    const endpoint = process.env.AZURE_IMAGE_ENDPOINT;
    const deploymentName = "gpt-image-2-1";
    const apiVersion = "2024-02-01";

    if (!apiKey || !endpoint) {
      console.error("❌ Missing Azure Credentials");
      return NextResponse.json({ error: "Azure API configuration missing" }, { status: 500 });
    }

    const prompt = userPrompt || "A modern AI startup office, ultra realistic, 4k";
    const baseUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
    const url = `${baseUrl}/openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`;

    console.log(`🎨 Sending request to Azure OpenAI: ${deploymentName}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      }
      return NextResponse.json({ error: `Azure API error: ${response.status}`, details: errorData }, { status: response.status });
    }

    const result = await response.json();
    let base64Data = result.data?.[0]?.b64_json;
    const imageUrl = result.data?.[0]?.url;

    if (!base64Data && imageUrl) {
      const imageRes = await fetch(imageUrl);
      const arrayBuffer = await imageRes.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
    }

    if (!base64Data) {
      throw new Error("No image data returned from Azure OpenAI");
    }

    const imageDataWithPrefix = `data:image/png;base64,${base64Data}`;

    return NextResponse.json({ image: imageDataWithPrefix, success: true });
  } catch (error: any) {
    console.error("💥 Internal Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
