import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dev-memory-hub.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_user(api_client):
    """Register a fresh test user and return token + user dict."""
    email = f"tester+{int(time.time())}@cortexflow.dev"
    password = "cortexflow123"
    name = "Tester"
    r = api_client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password, "name": name})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "password": password}


@pytest.fixture(scope="session")
def auth_headers(auth_user):
    return {"Authorization": f"Bearer {auth_user['token']}"}
