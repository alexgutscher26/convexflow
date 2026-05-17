import sys
import os
import uuid
import pytest
from fastapi.testclient import TestClient

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

# pyrefly: ignore [missing-import]
from server import app
import server

client = TestClient(app)

import asyncio

@pytest.fixture(autouse=True)
def cleanup_db():
    # Run before each test to ensure test users/projects don't collide
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        loop.create_task(server.db.users.delete_many({"email": {"$regex": "^test_auth_.*"}}))
        loop.create_task(server.db.projects.delete_many({"name": {"$regex": "^TEST_.*"}}))
        loop.create_task(server.db.nodes.delete_many({}))
        loop.create_task(server.db.edges.delete_many({}))
        loop.create_task(server.db.snapshots.delete_many({}))
    else:
        loop.run_until_complete(server.db.users.delete_many({"email": {"$regex": "^test_auth_.*"}}))
        loop.run_until_complete(server.db.projects.delete_many({"name": {"$regex": "^TEST_.*"}}))
        loop.run_until_complete(server.db.nodes.delete_many({}))
        loop.run_until_complete(server.db.edges.delete_many({}))
        loop.run_until_complete(server.db.snapshots.delete_many({}))
    yield


def generate_test_email():
    return f"test_auth_{uuid.uuid4().hex[:8]}@example.com"


def register_and_login(email, password, name):
    client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": name
    })
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    return login_resp.json()["token"]


def test_create_edge_verifies_nodes_in_project():
    email1 = generate_test_email()
    email2 = generate_test_email()
    password = "password123"

    token1 = register_and_login(email1, password, "User One")
    token2 = register_and_login(email2, password, "User Two")

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 1. User 1 creates Project A
    proj_a_resp = client.post("/api/projects", headers=headers1, json={
        "name": "TEST_ProjA",
        "description": "Project A Description",
        "project_type": "greenfield"
    })
    assert proj_a_resp.status_code == 200
    proj_a_id = proj_a_resp.json()["id"]

    # 2. User 2 creates Project B
    proj_b_resp = client.post("/api/projects", headers=headers2, json={
        "name": "TEST_ProjB",
        "description": "Project B Description",
        "project_type": "greenfield"
    })
    assert proj_b_resp.status_code == 200
    proj_b_id = proj_b_resp.json()["id"]

    # 3. User 1 creates Node A1 in Project A
    node_a1_resp = client.post(f"/api/projects/{proj_a_id}/nodes", headers=headers1, json={
        "type": "Feature Scope",
        "title": "Node A1",
        "content": "A1 content",
        "position_x": 0,
        "position_y": 0
    })
    assert node_a1_resp.status_code == 200
    node_a1_id = node_a1_resp.json()["id"]

    # 4. User 2 creates Node B1 in Project B
    node_b1_resp = client.post(f"/api/projects/{proj_b_id}/nodes", headers=headers2, json={
        "type": "Feature Scope",
        "title": "Node B1",
        "content": "B1 content",
        "position_x": 0,
        "position_y": 0
    })
    assert node_b1_resp.status_code == 200
    node_b1_id = node_b1_resp.json()["id"]

    # 5. User 1 attempts to create an edge in Project A connecting Node A1 and Node B1 (cross-project injection)
    edge_resp = client.post(f"/api/projects/{proj_a_id}/edges", headers=headers1, json={
        "source_node_id": node_a1_id,
        "target_node_id": node_b1_id,
        "relationship_type": "depends_on"
    })
    # This MUST fail with 400 Bad Request since Node B1 does not belong to Project A!
    assert edge_resp.status_code == 400
    assert "not found in this project" in edge_resp.json()["detail"]


def test_delete_project_cascades_snapshots():
    email = generate_test_email()
    password = "password123"

    token = register_and_login(email, password, "User One")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a project
    proj_resp = client.post("/api/projects", headers=headers, json={
        "name": "TEST_ProjToCascade",
        "description": "Project Description",
        "project_type": "greenfield"
    })
    assert proj_resp.status_code == 200
    proj_id = proj_resp.json()["id"]

    # 2. Create a manual snapshot
    snap_resp = client.post(f"/api/projects/{proj_id}/snapshots", headers=headers, json={
        "label": "Test Snapshot"
    })
    assert snap_resp.status_code == 200
    snap_id = snap_resp.json()["id"]

    # 3. Delete the project
    del_resp = client.delete(f"/api/projects/{proj_id}", headers=headers)
    assert del_resp.status_code == 200

    # 4. Verify snapshot is also deleted (get snapshot returns 404)
    get_snap_resp = client.get(f"/api/snapshots/{snap_id}", headers=headers)
    assert get_snap_resp.status_code == 404
