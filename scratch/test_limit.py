import http.client
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

# Use environment variables
ENDPOINT = os.getenv("AZURE_IMAGE_ENDPOINT", "")
KEY = os.getenv("AZURE_IMAGE_KEY", "")
DEPLOYMENT = "gpt-image-2-1"
API_VERSION = "2024-02-01"

def test_request(i):
    if not ENDPOINT or not KEY:
        return {"id": i, "status": "ERROR", "error": "Missing credentials in environment"}

    host = ENDPOINT.replace("https://", "").split("/")[0]
    conn = http.client.HTTPSConnection(host)
    
    url = f"/openai/deployments/{DEPLOYMENT}/images/generations?api-version={API_VERSION}"
    headers = {
        "Content-Type": "application/json",
        "api-key": KEY
    }
    body = json.dumps({
        "prompt": f"Rate limit test {i}",
        "n": 1,
        "size": "1024x1024"
    })
    
    start = time.time()
    try:
        conn.request("POST", url, body, headers)
        res = conn.getresponse()
        status = res.status
        data = res.read()
        duration = time.time() - start
        return {"id": i, "status": status, "duration": duration}
    except Exception as e:
        return {"id": i, "status": "ERROR", "error": str(e)}

def run_test(num_concurrent=5):
    print(f"Running {num_concurrent} concurrent requests to Azure OpenAI...")
    with ThreadPoolExecutor(max_workers=num_concurrent) as executor:
        results = list(executor.map(test_request, range(num_concurrent)))
    
    success = [r for r in results if r['status'] == 200]
    rate_limited = [r for r in results if r['status'] == 429]
    others = [r for r in results if r['status'] not in [200, 429]]
    
    print(f"\nResults:")
    print(f"  Success: {len(success)}")
    print(f"  Rate Limited (429): {len(rate_limited)}")
    print(f"  Other Errors: {len(others)}")
    
    if rate_limited:
        print("\nRate limit hit!")
    else:
        print("\nNo rate limit hit with this batch.")

if __name__ == "__main__":
    run_test(3) 
