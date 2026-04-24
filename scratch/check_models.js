const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkModels() {
  const apiKey = "AIzaSyCNwsfVoM827sPXqddHx_b7JLqZXcpcRnU"; // From their .env.local
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkModels();
