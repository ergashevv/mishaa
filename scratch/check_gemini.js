import { GoogleGenerativeAI } from "@google/generative-ai";

async function checkModels() {
  const apiKey = "AIzaSyCNwsfVoM827sPXqddHx_b7JLqZXcpcRnU"; // From their .env.local
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const models = await genAI.listModels();
    console.log(JSON.stringify(models, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkModels();
