export const runtime = "edge";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { targetImageUrl, sourceImageUrl } = await req.json();

    if (!targetImageUrl || !sourceImageUrl) {
      return NextResponse.json({ error: "Missing images" }, { status: 400 });
    }

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json({ error: "Replicate API token missing" }, { status: 500 });
    }

    console.log("🧬 Starting Face Swap with FOFR model...");

    const version = "90848981440cc0f5f8446b5bd60cb9c7f6b92f7041a774b77f22687c48209865";
    
    // 1. Create Prediction
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: version,
        input: {
          input_image: targetImageUrl,
          swap_image: sourceImageUrl,
        },
      }),
    });

    if (!createRes.ok) {
      const errorData = await createRes.json();
      throw new Error(`Replicate Error: ${errorData.detail || createRes.statusText}`);
    }

    let prediction = await createRes.json();
    const predictionId = prediction.id;

    // 2. Poll for results (Wait up to 60 seconds)
    let attempts = 0;
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { "Authorization": `Token ${apiToken}` },
      });
      prediction = await pollRes.json();
      attempts++;
    }

    if (prediction.status === "succeeded") {
      console.log("✅ Face Swap Complete");
      return NextResponse.json({ image: prediction.output });
    } else {
      throw new Error(`Face swap failed or timed out: ${prediction.status}`);
    }
  } catch (error: unknown) {
    console.error("Face Swap Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Face swap failed" }, { status: 500 });
  }
}
