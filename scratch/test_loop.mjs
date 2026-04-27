/**
 * Standalone test script for Azure OpenAI Rate Limits
 */

// --- CONFIG FROM ENV ---
const API_KEY = process.env.AZURE_IMAGE_KEY; 
const ENDPOINT = process.env.AZURE_IMAGE_ENDPOINT;
const DEPLOYMENT = "gpt-image-2-1";
const API_VERSION = "2024-02-01";
// --------------

if (!API_KEY || !ENDPOINT) {
  console.error("❌ Error: Missing AZURE_IMAGE_KEY or AZURE_IMAGE_ENDPOINT in environment.");
  process.exit(1);
}

const url = `${ENDPOINT.replace(/\/$/, "")}/openai/deployments/${DEPLOYMENT}/images/generations?api-version=${API_VERSION}`;

async function runTest() {
  console.log("🚀 Starting 10-request flood to check rate limits...");
  
  const tasks = Array.from({ length: 10 }).map(async (_, i) => {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": API_KEY
        },
        body: JSON.stringify({
          prompt: "A modern AI startup office, ultra realistic, 4k",
          n: 1,
          size: "1024x1024"
        })
      });

      const latency = Date.now() - start;
      if (res.status === 429) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`❌ [Req ${i+1}] 429 Rate Limited - ${latency}ms`);
        console.error(`   Message: ${errorData.error?.message || 'No message'}`);
      } else if (res.ok) {
        console.log(`✅ [Req ${i+1}] Success - 200 OK - ${latency}ms`);
      } else {
        console.error(`⚠️ [Req ${i+1}] Error ${res.status} - ${latency}ms`);
        const data = await res.json().catch(() => ({}));
        console.error(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error(`💥 [Req ${i+1}] Fetch failed:`, err.message);
    }
  });

  await Promise.all(tasks);
  console.log("🏁 Test complete.");
}

runTest();
