import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.AZURE_IMAGE_KEY;
  const endpoint = process.env.AZURE_IMAGE_ENDPOINT;
  const deploymentName = "gpt-image-2-1";
  const apiVersion = "2024-02-01";

  if (!apiKey || !endpoint) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const baseUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  const url = `${baseUrl}/openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`;
  
  const prompt = "A modern AI startup office, ultra realistic, 4k";
  const numRequests = 10;
  
  console.log(`🚀 Starting rate limit test: ${numRequests} concurrent requests...`);

  const startTime = Date.now();
  
  // Create 10 concurrent requests
  const requests = Array.from({ length: numRequests }).map(async (_, i) => {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          prompt: `${prompt} (test request #${i + 1})`, // Make them slightly unique
          n: 1,
          size: "1024x1024",
        }),
      });

      return {
        id: i + 1,
        status: resp.status,
        ok: resp.ok,
        data: await resp.json().catch(() => ({})),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      return {
        id: i + 1,
        status: "FETCH_ERROR",
        ok: false,
        error: message,
      };
    }
  });

  const results = await Promise.all(requests);
  const duration = Date.now() - startTime;

  const summary = {
    total: numRequests,
    success: results.filter(r => r.ok).length,
    rateLimited: results.filter(r => r.status === 429).length,
    errors: results.filter(r => !r.ok && r.status !== 429).length,
    durationMs: duration,
  };

  console.log("📊 Rate Limit Test Summary:", summary);
  results.forEach(r => {
    if (!r.ok) {
      console.warn(`[Req #${r.id}] Failed with status ${r.status}`, r.data || r.error);
    } else {
      console.log(`[Req #${r.id}] Success!`);
    }
  });

  return NextResponse.json({ summary, details: results });
}
