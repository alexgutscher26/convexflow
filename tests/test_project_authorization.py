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

async def perform_safe_cleanup():
    test_projects = []
    async for p in server.db.projects.find({"name": {"$regex": "^TEST_.*"}}):
        test_projects.append(p)
    test_project_ids = [p["id"] for p in test_projects]

    await server.db.users.delete_many({"email": {"$regex": "^test_auth_.*"}})
    await server.db.projects.delete_many({"name": {"$regex": "^TEST_.*"}})
    if test_project_ids:
        await server.db.nodes.delete_many({"project_id": {"$in": test_project_ids}})
        await server.db.edges.delete_many({"project_id": {"$in": test_project_ids}})
        await server.db.snapshots.delete_many({"project_id": {"$in": test_project_ids}})


@pytest.fixture(autouse=True)
def cleanup_db():
    # Run before each test to ensure test users/projects don't collide
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        loop.create_task(perform_safe_cleanup())
    else:
        loop.run_until_complete(perform_safe_cleanup())
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


def test_bulk_update_node_positions():
    email = generate_test_email()
    password = "password123"

    token = register_and_login(email, password, "User One")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a project
    proj_resp = client.post("/api/projects", headers=headers, json={
        "name": "TEST_ProjBulkUpdate",
        "description": "Project Description",
        "project_type": "greenfield"
    })
    assert proj_resp.status_code == 200
    proj_id = proj_resp.json()["id"]

    # 2. Create Node 1
    node1_resp = client.post(f"/api/projects/{proj_id}/nodes", headers=headers, json={
        "type": "Feature Scope",
        "title": "Node 1",
        "content": "Content 1",
        "position_x": 0,
        "position_y": 0
    })
    assert node1_resp.status_code == 200
    node1_id = node1_resp.json()["id"]

    # 3. Create Node 2
    node2_resp = client.post(f"/api/projects/{proj_id}/nodes", headers=headers, json={
        "type": "Feature Scope",
        "title": "Node 2",
        "content": "Content 2",
        "position_x": 10,
        "position_y": 10
    })
    assert node2_resp.status_code == 200
    node2_id = node2_resp.json()["id"]

    # 4. Perform bulk layout coordinate update
    bulk_resp = client.put(f"/api/projects/{proj_id}/nodes/positions", headers=headers, json={
        "positions": [
            {"id": node1_id, "position_x": 100.5, "position_y": 200.5},
            {"id": node2_id, "position_x": 300.0, "position_y": -400.0}
        ]
    })
    assert bulk_resp.status_code == 200
    assert bulk_resp.json()["ok"] is True
    assert bulk_resp.json()["modified_count"] == 2

    # 5. Verify Node 1 new positions
    nodes_resp = client.get(f"/api/projects/{proj_id}/nodes", headers=headers)
    assert nodes_resp.status_code == 200
    nodes = {n["id"]: n for n in nodes_resp.json()}
    
    assert nodes[node1_id]["position_x"] == 100.5
    assert nodes[node1_id]["position_y"] == 200.5
    assert nodes[node2_id]["position_x"] == 300.0
    assert nodes[node2_id]["position_y"] == -400.0
