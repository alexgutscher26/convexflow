import sys
import httpx
import os

# Use local port 8000
BASE_URL = "http://127.0.0.1:8000"

def test_rate_limiting():
    # Make sure rate limiting is active by NOT setting TESTING=true or explicitly setting TESTING=false
    os.environ["TESTING"] = "false"
    
    print("Testing rate limiting on login endpoint...")
    email = "rate_limit_test@example.com"
    password = "some_random_password"
    
    # We will make 6 requests. The first 5 should receive 401 (Invalid credentials).
    # The 6th request should receive 429 (Too Many Requests).
    
    headers = {"Content-Type": "application/json"}
    payload = {"email": email, "password": password}
    
    client = httpx.Client(base_url=BASE_URL)
    
    for i in range(1, 7):
        try:
            r = client.post("/api/auth/login", json=payload, headers=headers)
            print(f"Request {i}: HTTP {r.status_code} - Response: {r.text.strip()}")
            
            if i <= 5:
                # Expect 401 since credentials are invalid
                if r.status_code != 401:
                    print(f"Error: Expected HTTP 401 on request {i}, but got {r.status_code}", file=sys.stderr)
                    sys.exit(1)
            else:
                # Expect 429
                if r.status_code == 429:
                    print("\nSuccess! Rate limiting correctly blocked request 6 with HTTP 429.")
                    # Verify response payload
                    data = r.json()
                    assert data["error"] == "Rate Limit Exceeded"
                    assert "Too many requests" in data["detail"]
                    sys.exit(0)
                else:
                    print(f"Error: Expected HTTP 429 on request 6, but got {r.status_code}", file=sys.stderr)
                    sys.exit(1)
        except Exception as e:
            print(f"Connection failed: {e}. Is the backend server running locally on port 8000?", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    test_rate_limiting()
