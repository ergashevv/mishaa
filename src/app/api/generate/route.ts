import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Step 1: Vision analysis using the LATEST stable model
    let personDescription = "a young man with short dark hair";
    
    try {
      const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      const imageFiles = ["me.PNG", "me2.PNG", "me3.PNG", "me4.JPG", "me5.PNG"];
      const imageParts = [];

      for (const fileName of imageFiles) {
        const imagePath = path.join(process.cwd(), "public", fileName);
        if (fs.existsSync(imagePath)) {
          const imageData = fs.readFileSync(imagePath);
          imageParts.push({
            inlineData: {
              data: imageData.toString("base64"),
              mimeType: fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png"
            }
          });
        }
      }
      
      if (imageParts.length > 0) {
        console.log("🔍 Analyzing likeness with Gemini 1.5 Pro...");
        const analysisResult = await visionModel.generateContent([
          "Analyze these photos. Create a technical, highly detailed physical description for an AI portrait generator. Focus on facial geometry, nose shape, lip thickness, eye depth, skin undertones, and hair growth pattern. Ensure the description is unique to this person so they are unrecognizable from anyone else. Output only keywords.",
          ...imageParts
        ]);
        
        personDescription = analysisResult.response.text().trim();
        console.log("✅ Portrait Guide Ready");
      }
    } catch (visionError) {
      console.error("❌ Vision analysis failed, falling back to basic:", visionError);
    }

    // Step 2: Image Generation
    console.log("🎨 Attempting image generation with 2.5-flash-image...");
    // We use gemini-2.5-flash-image which supports generateContent and was in your list
    const imageModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

    const enhancedPrompt = `
      PHOTOREALISTIC 8K CINEMATIC IMAGE.
      SUBJECT: ${personDescription}. 
      MUST MATCH THE SUBJECT 100% IN LOOK AND FACIAL FEATURES.
      SCENE: ${prompt}.
      LIGHTING: High-contrast shadows, soft rim light, professional color grading.
      The result must look like a real photograph of this person.
    `;

    const result = await imageModel.generateContent(enhancedPrompt);
    const response = await result.response;
    
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(p => p.inlineData);

    if (imagePart && imagePart.inlineData) {
        const base64 = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType;
        return NextResponse.json({ url: `data:${mimeType};base64,${base64}` });
    }

    throw new Error("No image data in response. The model might be overloaded or restricted.");

  } catch (error: any) {
    console.error("Gemini Route Error:", error);
    // If it's a 503, tell the user to wait a moment
    const isOverloaded = error.message?.includes("503") || error.message?.includes("high demand");
    return NextResponse.json(
      { error: isOverloaded ? "AI is busy (503). Please wait 10 seconds and try again." : error.message },
      { status: isOverloaded ? 503 : 500 }
    );
  }
}
