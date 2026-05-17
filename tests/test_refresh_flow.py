import sys
import os
import uuid
import pytest
from datetime import datetime, timezone

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
# pyrefly: ignore [missing-import]
from server import app
# pyrefly: ignore [missing-import]
import server

client = TestClient(app)

import asyncio

@pytest.fixture(autouse=True)
def cleanup_db():
    # Run before each test to ensure test users/tokens don't collide
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        loop.create_task(server.db.users.delete_many({"email": {"$regex": "^test_refresh_.*"}}))
        loop.create_task(server.db.refresh_tokens.delete_many({}))
    else:
        loop.run_until_complete(server.db.users.delete_many({"email": {"$regex": "^test_refresh_.*"}}))
        loop.run_until_complete(server.db.refresh_tokens.delete_many({}))
    yield


def generate_test_email():
    return f"test_refresh_{uuid.uuid4().hex[:8]}@example.com"


def test_auth_and_refresh_flow():
    email = generate_test_email()
    password = "supersecurepassword123"
    name = "Test JWT User"

    # 1. Register a new user
    reg_resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": name
    })
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert "token" in reg_data
    assert "refresh_token" in reg_data
    assert reg_data["user"]["email"] == email

    # 2. Login the user
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    token = login_data["token"]
    refresh_token = login_data["refresh_token"]

    # 3. Test protected route with access token
    proj_resp = client.get("/api/projects", headers={"Authorization": f"Bearer {token}"})
    assert proj_resp.status_code == 200

    # 4. Refresh token rotation
    refresh_resp = client.post("/api/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert refresh_resp.status_code == 200
    refresh_data = refresh_resp.json()
    new_token = refresh_data["token"]
    new_refresh_token = refresh_data["refresh_token"]

    assert new_token != token
    assert new_refresh_token != refresh_token

    # 5. Access route with new access token
    proj_resp2 = client.get("/api/projects", headers={"Authorization": f"Bearer {new_token}"})
    assert proj_resp2.status_code == 200

    # 6. Attempt to use old refresh token again (should trigger theft detection)
    reuse_resp = client.post("/api/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert reuse_resp.status_code == 401
    
    # 7. Attempt to use the rotated refresh token (which should now be revoked due to reuse detection)
    rotated_resp = client.post("/api/auth/refresh", json={
        "refresh_token": new_refresh_token
    })
    assert rotated_resp.status_code == 401


def test_logout_revokes_token():
    email = generate_test_email()
    password = "supersecurepassword123"
    name = "Test Logout User"

    # Register & Login
    client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": name
    })
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    refresh_token = login_resp.json()["refresh_token"]

    # Logout
    logout_resp = client.post("/api/auth/logout", json={
        "refresh_token": refresh_token
    })
    assert logout_resp.status_code == 200

    # Refresh should now fail
    refresh_resp = client.post("/api/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert refresh_resp.status_code == 401
