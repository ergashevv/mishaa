const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function checkLimit() {
  const apiKey = process.env.AZURE_IMAGE_KEY;
  const endpoint = process.env.AZURE_IMAGE_ENDPOINT;
  const deploymentName = "gpt-image-2-1";
  const apiVersion = "2024-02-01";

  const baseUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  const url = `${baseUrl}/openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`;

  console.log("Testing Azure OpenAI Rate Limit...");
  
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push(
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          prompt: `Test image ${i + 1}`,
          n: 1,
          size: "1024x1024",
        }),
      }).then(async r => {
        return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
      })
    );
  }

  const results = await Promise.all(requests);
  
  const success = results.filter(r => r.ok).length;
  const limited = results.filter(r => r.status === 429).length;
  const others = results.length - success - limited;

  console.log(`Results: ${success} success, ${limited} rate limited, ${others} errors.`);
  
  if (limited > 0) {
    console.log("Rate limit hit at 5 concurrent requests.");
  } else {
    console.log("All 5 requests succeeded. The limit is at least 5 per batch.");
  }
}

checkLimit();
