"""End-to-end backend tests for CortexFlow MVP."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dev-memory-hub.preview.emergentagent.com").rstrip("/")


# ---------- Auth ----------
class TestAuth:
    def test_register_returns_token(self, api_client):
        email = f"reg+{int(time.time()*1000)}@cortexflow.dev"
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "secret123", "name": "Reg"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 0
        assert d["user"]["email"] == email
        assert d["user"]["name"] == "Reg"
        assert "id" in d["user"]

    def test_register_duplicate_400(self, api_client, auth_user):
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": auth_user["email"], "password": "secret123", "name": "Dup"})
        assert r.status_code == 400

    def test_login_success(self, api_client, auth_user):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": auth_user["email"], "password": auth_user["password"]})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_bad_creds_401(self, api_client, auth_user):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": auth_user["email"], "password": "wrongpw"})
        assert r.status_code == 401

    def test_me_with_token(self, api_client, auth_headers, auth_user):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == auth_user["email"]
        # password_hash should not leak
        assert "password_hash" not in r.json()

    def test_me_without_token_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_projects_without_token_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 401


# ---------- Projects ----------
class TestProjects:
    def test_create_list_get_update_delete(self, api_client, auth_headers):
        # create
        r = api_client.post(f"{BASE_URL}/api/projects", headers=auth_headers,
                            json={"name": "TEST_proj", "description": "d"})
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["name"] == "TEST_proj"

        # list
        r = api_client.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())

        # get
        r = api_client.get(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == pid

        # update
        r = api_client.put(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers,
                           json={"name": "TEST_proj_renamed"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_proj_renamed"

        # delete
        r = api_client.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)
        assert r.status_code == 200
        r2 = api_client.get(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)
        assert r2.status_code == 404

    def test_get_other_user_project_403(self, api_client, auth_headers):
        # create with first user
        r = api_client.post(f"{BASE_URL}/api/projects", headers=auth_headers,
                            json={"name": "TEST_secret"})
        pid = r.json()["id"]
        # register second user
        email = f"other+{int(time.time()*1000)}@cortexflow.dev"
        r2 = api_client.post(f"{BASE_URL}/api/auth/register",
                             json={"email": email, "password": "secret123", "name": "Other"})
        token2 = r2.json()["token"]
        h2 = {"Authorization": f"Bearer {token2}"}
        r3 = api_client.get(f"{BASE_URL}/api/projects/{pid}", headers=h2)
        assert r3.status_code == 403
        # cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)


# ---------- Nodes & Edges ----------
@pytest.fixture(scope="class")
def project_id(api_client, auth_headers):
    r = api_client.post(f"{BASE_URL}/api/projects", headers=auth_headers,
                        json={"name": "TEST_nodes_proj"})
    pid = r.json()["id"]
    yield pid
    api_client.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)


class TestNodesEdges:
    def test_create_node(self, api_client, auth_headers, project_id):
        r = api_client.post(f"{BASE_URL}/api/projects/{project_id}/nodes", headers=auth_headers,
                            json={"type": "Feature Scope", "title": "Auth", "content": "body",
                                  "position_x": 10, "position_y": 20})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type"] == "Feature Scope"
        assert d["title"] == "Auth"
        assert d["position_x"] == 10
        pytest.node_id = d["id"]

    def test_list_nodes(self, api_client, auth_headers, project_id):
        r = api_client.get(f"{BASE_URL}/api/projects/{project_id}/nodes", headers=auth_headers)
        assert r.status_code == 200
        assert any(n["id"] == pytest.node_id for n in r.json())

    def test_update_node(self, api_client, auth_headers):
        r = api_client.put(f"{BASE_URL}/api/nodes/{pytest.node_id}", headers=auth_headers,
                           json={"title": "Auth2", "content": "new", "file_references": ["src/a.py"]})
        assert r.status_code == 200
        assert r.json()["title"] == "Auth2"
        assert r.json()["file_references"] == ["src/a.py"]

    def test_create_and_list_edge(self, api_client, auth_headers, project_id):
        r1 = api_client.post(f"{BASE_URL}/api/projects/{project_id}/nodes", headers=auth_headers,
                             json={"type": "User Stories", "title": "S"})
        n2 = r1.json()["id"]
        r = api_client.post(f"{BASE_URL}/api/projects/{project_id}/edges", headers=auth_headers,
                            json={"source_node_id": pytest.node_id, "target_node_id": n2,
                                  "relationship_type": "depends_on"})
        assert r.status_code == 200
        pytest.edge_id = r.json()["id"]
        r2 = api_client.get(f"{BASE_URL}/api/projects/{project_id}/edges", headers=auth_headers)
        assert any(e["id"] == pytest.edge_id for e in r2.json())

    def test_delete_edge(self, api_client, auth_headers):
        r = api_client.delete(f"{BASE_URL}/api/edges/{pytest.edge_id}", headers=auth_headers)
        assert r.status_code == 200

    def test_delete_node(self, api_client, auth_headers):
        r = api_client.delete(f"{BASE_URL}/api/nodes/{pytest.node_id}", headers=auth_headers)
        assert r.status_code == 200


# ---------- Repository ----------
class TestRepo:
    def test_connect_and_scan_public_repo(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/projects", headers=auth_headers,
                            json={"name": "TEST_repo"})
        pid = r.json()["id"]
        try:
            rc = api_client.post(f"{BASE_URL}/api/projects/{pid}/repository", headers=auth_headers,
                                 json={"owner": "octocat", "repo": "Hello-World", "branch": "master"})
            assert rc.status_code == 200, rc.text
            assert rc.json()["owner"] == "octocat"
            rs = api_client.post(f"{BASE_URL}/api/projects/{pid}/repository/scan", headers=auth_headers, json={})
            assert rs.status_code == 200, rs.text
            assert "file_tree" in rs.json()
            assert "frameworks" in rs.json()
        finally:
            api_client.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)


# ---------- AI (Claude) ----------
class TestAI:
    def test_ai_expand_acceptance_criteria(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/projects", headers=auth_headers, json={"name": "TEST_ai"})
        pid = r.json()["id"]
        try:
            rn = api_client.post(f"{BASE_URL}/api/projects/{pid}/nodes", headers=auth_headers,
                                 json={"type": "Feature Scope", "title": "User login",
                                       "content": "Users sign in with email/password."})
            nid = rn.json()["id"]
            r = api_client.post(f"{BASE_URL}/api/ai/expand", headers=auth_headers,
                                json={"node_id": nid, "instruction": "acceptance_criteria"},
                                timeout=90)
            assert r.status_code == 200, r.text
            assert isinstance(r.json().get("content"), str)
            assert len(r.json()["content"]) > 20
        finally:
            api_client.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)

    def test_ai_generate_prompt(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/projects", headers=auth_headers, json={"name": "TEST_prompt"})
        pid = r.json()["id"]
        try:
            api_client.post(f"{BASE_URL}/api/projects/{pid}/nodes", headers=auth_headers,
                            json={"type": "Product Overview", "title": "X", "content": "An app."})
            r = api_client.post(f"{BASE_URL}/api/projects/{pid}/ai/generate-prompt",
                                headers=auth_headers, json={"template": "feature_implementation"}, timeout=90)
            assert r.status_code == 200, r.text
            assert isinstance(r.json().get("prompt"), str)
            assert len(r.json()["prompt"]) > 50
        finally:
            api_client.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)


# ---------- Export ----------
class TestExport:
    def test_export_formats(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/projects", headers=auth_headers, json={"name": "TEST_export"})
        pid = r.json()["id"]
        try:
            api_client.post(f"{BASE_URL}/api/projects/{pid}/nodes", headers=auth_headers,
                            json={"type": "Product Overview", "title": "T", "content": "C"})
            for fmt in ["markdown", "json", "agent_pack"]:
                r = api_client.post(f"{BASE_URL}/api/projects/{pid}/export", headers=auth_headers,
                                    json={"format": fmt})
                assert r.status_code == 200, f"{fmt}: {r.text}"
                assert r.json()["format"] == fmt
                assert r.json().get("content") is not None
        finally:
            api_client.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)


# ---------- Node types meta ----------
def test_node_types_endpoint(api_client):
    r = api_client.get(f"{BASE_URL}/api/node-types")
    assert r.status_code == 200
    types = r.json()["types"]
    assert len(types) == 12
