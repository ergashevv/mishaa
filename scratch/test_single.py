import http.client
import json
import os

# Use environment variables
ENDPOINT = os.getenv("AZURE_IMAGE_ENDPOINT", "")
KEY = os.getenv("AZURE_IMAGE_KEY", "")
DEPLOYMENT = "gpt-image-2-1"
API_VERSION = "2024-02-01"

def test_single():
    if not ENDPOINT or not KEY:
        print("Missing credentials")
        return

    host = ENDPOINT.replace("https://", "").split("/")[0]
    conn = http.client.HTTPSConnection(host)
    
    url = f"/openai/deployments/{DEPLOYMENT}/images/generations?api-version={API_VERSION}"
    headers = {
        "Content-Type": "application/json",
        "api-key": KEY
    }
    body = json.dumps({
        "prompt": "A single test prompt",
        "n": 1,
        "size": "1024x1024"
    })
    
    conn.request("POST", url, body, headers)
    res = conn.getresponse()
    print(f"Status: {res.status}")
    print(res.read().decode())

if __name__ == "__main__":
    test_single()
