"""Graph validation engine.

Stateless rule checks applied to a project's nodes + edges. Each rule emits
issues with `severity`, `code`, `message`, and a concrete `suggestion`.
"""
from __future__ import annotations


GLOBAL_TYPES = {"AI Coding Rules", "GitHub Context", "Prompt Output", "Product Overview"}


def validate_graph(nodes: list[dict], edges: list[dict]) -> dict:
    issues: list[dict] = []
    nodes_by_id = {n["id"]: n for n in nodes}
    nodes_by_type: dict[str, list[dict]] = {}
    for n in nodes:
        nodes_by_type.setdefault(n["type"], []).append(n)

    out_edges: dict[str, list[dict]] = {n["id"]: [] for n in nodes}
    in_edges: dict[str, list[dict]] = {n["id"]: [] for n in nodes}
    for e in edges:
        out_edges.setdefault(e["source_node_id"], []).append(e)
        in_edges.setdefault(e["target_node_id"], []).append(e)

    def add(severity, code, message, suggestion, node_id=None):
        issues.append({
            "node_id": node_id,
            "severity": severity,
            "code": code,
            "message": message,
            "suggestion": suggestion,
        })

    # 1. No Product Overview at all
    if not nodes_by_type.get("Product Overview"):
        add("error", "no_product_overview",
            "Project has no Product Overview node.",
            "Add a Product Overview node so prompts have a vision anchor.")

    # 2. No AI Coding Rules
    if not nodes_by_type.get("AI Coding Rules"):
        add("info", "no_coding_rules",
            "No AI Coding Rules node defined.",
            "Add coding conventions so generated prompts are constrained.")

    # 3. Per-node checks
    for n in nodes:
        nid = n["id"]
        ntype = n["type"]
        content = (n.get("content") or "").strip()

        # 3a. Empty / placeholder content
        if len(content) < 20:
            add("info", "empty_content",
                f"{ntype} '{n.get('title') or 'untitled'}' has little or no content.",
                "Fill in the node so prompts can ground decisions on it.",
                node_id=nid)

        # 3b. Disconnected non-global nodes
        if ntype not in GLOBAL_TYPES:
            if not out_edges.get(nid) and not in_edges.get(nid):
                add("warning", "disconnected_node",
                    f"{ntype} '{n.get('title') or 'untitled'}' is disconnected.",
                    "Link it to upstream context or downstream consumers.",
                    node_id=nid)

        # 3c. Feature Scope must have Acceptance Criteria downstream
        if ntype == "Feature Scope":
            downstream_ids = {e["target_node_id"] for e in out_edges.get(nid, [])}
            downstream_types = {
                nodes_by_id[i]["type"] for i in downstream_ids if i in nodes_by_id
            }
            if "Acceptance Criteria" not in downstream_types:
                add("warning", "feature_without_acceptance",
                    f"Feature '{n.get('title')}' has no linked Acceptance Criteria.",
                    "Add an Acceptance Criteria node and connect this feature to it.",
                    node_id=nid)
            if "Technical Architecture" not in downstream_types and "Technical Architecture" not in {
                nodes_by_id[i]["type"] for i in {e["source_node_id"] for e in in_edges.get(nid, [])} if i in nodes_by_id
            }:
                add("info", "feature_without_arch",
                    f"Feature '{n.get('title')}' has no linked Technical Architecture.",
                    "Link to a Tech Architecture node so prompts know the stack.",
                    node_id=nid)

        # 3d. API Contracts must link to Database Schema (either direction)
        if ntype == "API Contracts":
            neighbour_ids = {e["target_node_id"] for e in out_edges.get(nid, [])} | {
                e["source_node_id"] for e in in_edges.get(nid, [])
            }
            neighbour_types = {
                nodes_by_id[i]["type"] for i in neighbour_ids if i in nodes_by_id
            }
            if "Database Schema" not in neighbour_types:
                add("warning", "api_without_schema",
                    f"API Contracts '{n.get('title')}' has no linked Database Schema.",
                    "Connect to a DB Schema node so endpoint payloads match entities.",
                    node_id=nid)

        # 3e. Database Schema with no API or UI consumer
        if ntype == "Database Schema":
            neighbour_ids = {e["target_node_id"] for e in out_edges.get(nid, [])} | {
                e["source_node_id"] for e in in_edges.get(nid, [])
            }
            neighbour_types = {
                nodes_by_id[i]["type"] for i in neighbour_ids if i in nodes_by_id
            }
            if not (neighbour_types & {"API Contracts", "UI Requirements"}):
                add("info", "schema_without_consumer",
                    f"DB Schema '{n.get('title')}' has no API or UI consumer.",
                    "Link to an API Contracts or UI Requirements node.",
                    node_id=nid)

        # 3f. Acceptance Criteria orphan (no Feature Scope upstream)
        if ntype == "Acceptance Criteria":
            upstream_types = {
                nodes_by_id[e["source_node_id"]]["type"]
                for e in in_edges.get(nid, [])
                if e["source_node_id"] in nodes_by_id
            }
            if "Feature Scope" not in upstream_types:
                add("info", "acceptance_without_feature",
                    f"Acceptance Criteria '{n.get('title')}' has no Feature Scope upstream.",
                    "Connect a Feature Scope node to this acceptance node.",
                    node_id=nid)

    # 4. Tech Architecture with no API or DB
    for arch in nodes_by_type.get("Technical Architecture", []):
        nid = arch["id"]
        neighbour_ids = {e["target_node_id"] for e in out_edges.get(nid, [])} | {
            e["source_node_id"] for e in in_edges.get(nid, [])
        }
        neighbour_types = {
            nodes_by_id[i]["type"] for i in neighbour_ids if i in nodes_by_id
        }
        if not (neighbour_types & {"API Contracts", "Database Schema"}):
            add("info", "arch_without_impl",
                f"Architecture '{arch.get('title')}' has no API or DB linked.",
                "Connect downstream API Contracts or DB Schema implementations.",
                node_id=nid)

    counts = {"error": 0, "warning": 0, "info": 0}
    for i in issues:
        counts[i["severity"]] = counts.get(i["severity"], 0) + 1

    return {
        "issues": issues,
        "summary": {
            "error_count": counts["error"],
            "warning_count": counts["warning"],
            "info_count": counts["info"],
            "total": len(issues),
            "ready_for_prompt": counts["error"] == 0,
        },
    }
