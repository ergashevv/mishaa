import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const { targetImageUrl, sourceImageUrl } = await req.json();

    if (!targetImageUrl || !sourceImageUrl) {
      return NextResponse.json({ error: "Missing images" }, { status: 400 });
    }

    console.log("🧬 Starting Face Swap with FOFR model...");

    // Using fofr/face-swap: extremely stable and high quality
    const output = await replicate.run(
      "fofr/face-swap:90848981440cc0f5f8446b5bd60cb9c7f6b92f7041a774b77f22687c48209865",
      {
        input: {
          input_image: targetImageUrl, // The DALL-E generated image
          swap_image: sourceImageUrl, // The character reference image
        }
      }
    );

    console.log("✅ Face Swap Complete");
    return NextResponse.json({ image: output });
  } catch (error: unknown) {
    console.error("Face Swap Error:", error);
    const message = error instanceof Error ? error.message : "Face swap failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
