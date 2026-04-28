// Native fetch is available in Node 22


const API_KEY = 'sk-5f7ede121f952d3f92a654b4037f524a1265e0c7e93b4e0e7f39c30c16422504';
const BASE_URL = 'https://api.llamagen.ai/v1';

async function testApi() {
  console.log('--- LlamaGen API Test ---');
  
  try {
    // 1. Start Generation
    console.log('1. Starting generation...');
    const genRes = await fetch(`${BASE_URL}/comics/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'A futuristic city in a comic book style',
        preset: 'Digital Painting',
        size: '1024x1024'
      })
    });

    const genData = await genRes.json();
    if (!genRes.ok) {
      console.error('Generation failed:', genData);
      return;
    }

    const genId = genData.id;
    console.log(`Generation started! ID: ${genId}`);

    // 2. Poll for Status
    console.log('2. Polling for status...');
    let status = genData.status;
    let attempts = 0;
    
    while (status === 'LOADING' || status === 'processing' || status === 'queued') {
      attempts++;
      if (attempts > 20) {
        console.log('Max attempts reached. Stopping poll.');
        break;
      }

      await new Promise(r => setTimeout(r, 5000));
      
      const statusRes = await fetch(`${BASE_URL}/comics/generations/${genId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const statusData = await statusRes.json();
      status = statusData.status;
      console.log(`Attempt ${attempts}: Status is ${status}`);

      if (status === 'completed' || status === 'success' || status === 'COMPLETED') {
        const imageUrl = statusData.imageUrl || statusData.resultUrl || statusData.data?.[0]?.url;
        console.log('SUCCESS! Image URL:', imageUrl);
        break;
      }

      if (status === 'failed' || status === 'FAILED') {
        console.error('Generation failed on server.');
        break;
      }
    }

  } catch (error) {
    console.error('Test Error:', error);
  }
}

testApi();
