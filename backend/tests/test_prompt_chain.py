"""Integration tests for ConvexFlow Prompt Chaining feature."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")

class TestPromptChain:
    def test_execute_prompt_unauthorized(self, api_client):
        """Verify that executing a node prompt blocks unauthorized requests."""
        r = api_client.post(f"{BASE_URL}/api/nodes/nonexistent/execute-prompt")
        assert r.status_code == 401

    def test_prompt_chain_ordering_and_cycle_detection(self, api_client, auth_headers):
        """Verify that prompt chain order is topologically sorted and cycle detection throws 400."""
        # 1. Create a project
        r = api_client.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers,
            json={"name": "Chain Test Project"}
        )
        assert r.status_code == 200
        proj_id = r.json()["id"]

        try:
            # 2. Create three 'Prompt Output' nodes
            # Node A
            r_a = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/nodes",
                headers=auth_headers,
                json={"type": "Prompt Output", "title": "Node A", "content": "Generate a database schema."}
            )
            assert r_a.status_code == 200
            node_a_id = r_a.json()["id"]

            # Node B
            r_b = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/nodes",
                headers=auth_headers,
                json={"type": "Prompt Output", "title": "Node B", "content": "Generate an API layer based on Node A."}
            )
            assert r_b.status_code == 200
            node_b_id = r_b.json()["id"]

            # Node C
            r_c = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/nodes",
                headers=auth_headers,
                json={"type": "Prompt Output", "title": "Node C", "content": "Generate a frontend based on Node B."}
            )
            assert r_c.status_code == 200
            node_c_id = r_c.json()["id"]

            # 3. Create edges linking A -> B -> C (DAG connection)
            # Edge A -> B
            r_ab = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/edges",
                headers=auth_headers,
                json={"source_node_id": node_a_id, "target_node_id": node_b_id, "relationship_type": "depends_on"}
            )
            assert r_ab.status_code == 200

            # Edge B -> C
            r_bc = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/edges",
                headers=auth_headers,
                json={"source_node_id": node_b_id, "target_node_id": node_c_id, "relationship_type": "depends_on"}
            )
            assert r_bc.status_code == 200

            # 4. Fetch the execution order and verify Kahn's algorithm sorting
            r_order = api_client.get(
                f"{BASE_URL}/api/projects/{proj_id}/prompt-chain-order",
                headers=auth_headers
            )
            assert r_order.status_code == 200
            order_data = r_order.json()
            assert "order" in order_data
            assert "nodes" in order_data
            
            # The topological order MUST be A, then B, then C
            order_list = order_data["order"]
            assert order_list == [node_a_id, node_b_id, node_c_id]
            assert order_data["nodes"][0]["title"] == "Node A"

            # 5. Create a cycle: C -> A
            r_cycle_edge = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/edges",
                headers=auth_headers,
                json={"source_node_id": node_c_id, "target_node_id": node_a_id, "relationship_type": "depends_on"}
            )
            assert r_cycle_edge.status_code == 200
            cycle_edge_id = r_cycle_edge.json()["id"]

            # Fetch order again; it should throw a 400 cycle error
            r_cycle_order = api_client.get(
                f"{BASE_URL}/api/projects/{proj_id}/prompt-chain-order",
                headers=auth_headers
            )
            assert r_cycle_order.status_code == 400
            assert "Cycle detected" in r_cycle_order.json()["detail"]

            # Cleanup cycle edge
            api_client.delete(f"{BASE_URL}/api/edges/{cycle_edge_id}", headers=auth_headers)

        finally:
            api_client.delete(f"{BASE_URL}/api/projects/{proj_id}", headers=auth_headers)

    def test_single_prompt_execution(self, api_client, auth_headers):
        """Verify that single prompt node execution works and persists inputs and generated outputs."""
        r = api_client.post(
            f"{BASE_URL}/api/projects",
            headers=auth_headers,
            json={"name": "Single Prompt Test Project"}
        )
        assert r.status_code == 200
        proj_id = r.json()["id"]

        try:
            # Create a Prompt Output node
            prompt_content = "Write a hello world in Python."
            r_node = api_client.post(
                f"{BASE_URL}/api/projects/{proj_id}/nodes",
                headers=auth_headers,
                json={"type": "Prompt Output", "title": "Hello Code", "content": prompt_content}
            )
            assert r_node.status_code == 200
            node_id = r_node.json()["id"]

            # Execute the prompt node
            r_exec = api_client.post(
                f"{BASE_URL}/api/nodes/{node_id}/execute-prompt",
                headers=auth_headers
            )
            assert r_exec.status_code == 200, r_exec.text
            exec_data = r_exec.json()
            
            # The prompt text should be safely stored in metadata
            assert exec_data["metadata"]["prompt"] == prompt_content
            assert exec_data["metadata"]["executed"] is True
            # Generated content should contain output
            assert "print" in exec_data["content"] or "hello" in exec_data["content"].lower()

        finally:
            api_client.delete(f"{BASE_URL}/api/projects/{proj_id}", headers=auth_headers)
