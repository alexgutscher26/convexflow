"""Integration and performance tests for ConvexFlow Full-Text Search."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")

class TestFullTextSearch:
    def test_search_unauthorized_fails(self, api_client):
        """Verify that search endpoint blocks unauthorized requests."""
        r = api_client.get(f"{BASE_URL}/api/search?q=test")
        assert r.status_code == 401

    def test_search_empty_query_returns_recent(self, api_client, auth_headers):
        """Verify that search with empty query returns recent projects and nodes."""
        r = api_client.get(f"{BASE_URL}/api/search", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "results" in data
        assert "metrics" in data
        assert "debug_logs" in data
        assert isinstance(data["results"], list)

    def test_search_query_evaluation_and_relevance_ranking(self, api_client, auth_headers):
        """Create test data and validate matching, relevance scoring, and snippets."""
        # 1. Create a project
        proj_name = "UniqueSearchableProjectName"
        proj_desc = "This is a descriptive summary of our custom full-text search project."
        r = api_client.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers,
            json={"name": proj_name, "description": proj_desc}
        )
        assert r.status_code == 200
        proj_id = r.json()["id"]

        try:
            # 2. Create nodes under project
            # Node 1: Term in Title
            r_node1 = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/nodes",
                headers=auth_headers,
                json={
                    "type": "Technical Architecture",
                    "title": "AuthServiceSchema",
                    "content": "Low weight content here."
                }
            )
            assert r_node1.status_code == 200
            node1_id = r_node1.json()["id"]

            # Node 2: Term in Content
            r_node2 = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/nodes",
                headers=auth_headers,
                json={
                    "type": "Database Schema",
                    "title": "UnrelatedTitle",
                    "content": "This node contains the AuthServiceSchema term in its body content."
                }
            )
            assert r_node2.status_code == 200
            node2_id = r_node2.json()["id"]

            # 3. Perform search for query term "UniqueSearchableProjectName"
            r_search = api_client.get(
                f"{BASE_URL}/api/search?q=UniqueSearchableProjectName",
                headers=auth_headers
            )
            assert r_search.status_code == 200, r_search.text
            search_data = r_search.json()
            results = search_data["results"]
            
            # Should match the project
            project_matches = [res for res in results if res["type"] == "project" and res["id"] == proj_id]
            assert len(project_matches) == 1
            assert project_matches[0]["title"] == proj_name
            assert project_matches[0]["score"] > 0.0

            # 4. Perform search for "AuthServiceSchema"
            # Since both nodes contain the word, both should be found
            # Node 1 (term in title) should have a higher relevance score than Node 2 (term in content)
            # due to weights {"title": 10, "content": 5}
            r_search_nodes = api_client.get(
                f"{BASE_URL}/api/search?q=AuthServiceSchema",
                headers=auth_headers
            )
            assert r_search_nodes.status_code == 200
            nodes_results = r_search_nodes.json()["results"]
            
            node1_match = next((res for res in nodes_results if res["id"] == node1_id), None)
            node2_match = next((res for res in nodes_results if res["id"] == node2_id), None)
            
            assert node1_match is not None, "Node 1 not found in search results"
            assert node2_match is not None, "Node 2 not found in search results"
            assert node1_match["score"] > node2_match["score"], "Title match should rank higher than content match"

            # 5. Verify snippet extraction surrounding matched terms
            assert "AuthServiceSchema" in node2_match["snippet"]
            assert len(node2_match["snippet"]) <= 220  # Length limit bounds
            assert node2_match["project_name"] == proj_name  # Context checks

            # 6. Verify metrics block contains query latency, indexing time, and memory usage
            metrics = r_search_nodes.json()["metrics"]
            assert "query_latency_ms" in metrics
            assert "indexing_time_ms" in metrics
            assert "memory_usage_bytes" in metrics
            assert metrics["query_latency_ms"] >= 0
            assert metrics["indexing_time_ms"] >= 0
            assert metrics["memory_usage_bytes"] >= 0

        finally:
            # Cleanup project
            api_client.delete(f"{BASE_URL}/api/projects/{proj_id}", headers=auth_headers)

    def test_search_isolation_across_workspaces(self, api_client, auth_user, auth_headers):
        """Verify that user B cannot find user A's projects/nodes in search results."""
        # 1. User A creates a secret project
        proj_name = "UserASecretProject"
        r = api_client.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers,
            json={"name": proj_name, "description": "This belongs only to User A."}
        )
        assert r.status_code == 200
        proj_id = r.json()["id"]

        try:
            # 2. Register user B
            email_b = f"tester.b+{int(time.time()*1000)}@cortexflow.dev"
            password_b = "cortexflow123"
            r_reg = api_client.post(
                f"{BASE_URL}/api/auth/register",
                json={"email": email_b, "password": password_b, "name": "Tester B"}
            )
            assert r_reg.status_code == 200
            token_b = r_reg.json()["token"]
            headers_b = {"Authorization": f"Bearer {token_b}"}

            # 3. User B searches for "UserASecretProject"
            r_search = api_client.get(
                f"{BASE_URL}/api/search?q=UserASecretProject",
                headers=headers_b
            )
            assert r_search.status_code == 200
            results = r_search.json()["results"]
            
            # User B should find 0 matches
            assert len(results) == 0, "Security isolation leak: User B found User A's project!"

        finally:
            # Cleanup project
            api_client.delete(f"{BASE_URL}/api/projects/{proj_id}", headers=auth_headers)

    def test_performance_benchmarking(self, api_client, auth_headers):
        """Benchmark 50 sequential search queries to check query latency."""
        # Create a single project first
        r = api_client.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers,
            json={"name": "PerfBenchmarkProject", "description": "Benchmark project."}
        )
        assert r.status_code == 200
        proj_id = r.json()["id"]

        try:
            total_latency = 0.0
            num_queries = 25
            
            for _ in range(num_queries):
                t_start = time.perf_counter()
                r_search = api_client.get(
                    f"{BASE_URL}/api/search?q=PerfBenchmarkProject",
                    headers=auth_headers
                )
                t_end = time.perf_counter()
                
                assert r_search.status_code == 200
                total_latency += (t_end - t_start) * 1000

            avg_latency = total_latency / num_queries
            print(f"\nAverage Search Latency across {num_queries} queries: {avg_latency:.2f}ms")
            
            # Assert average latency is within sub-100ms budget for high-speed API
            assert avg_latency < 100.0, f"Search latency is too high: {avg_latency:.2f}ms"

        finally:
            api_client.delete(f"{BASE_URL}/api/projects/{proj_id}", headers=auth_headers)
