"""Quick-start wizard graph builder.

Maps a small set of wizard answers into a tailored starter graph (nodes
+ typed edges). Deterministic — no LLM call needed.
"""
from __future__ import annotations
from typing import Literal


def build_wizard_graph(answers: dict) -> dict:
    """Return {nodes, edges} where each node has ref + type + title +
    content + x + y, and edges use refs.
    """
    name = answers.get("name", "Project")
    description = answers.get("description", "")
    project_kind: str = answers.get("project_kind", "saas_app")
    stack: list[str] = answers.get("stack", [])
    features: list[str] = [f.strip() for f in answers.get("features", []) if f.strip()]
    team_size: str = answers.get("team_size", "solo")
    ai_tools: list[str] = answers.get("ai_tools", [])
    deployment: str = answers.get("deployment", "vercel")

    stack_str = ", ".join(stack) if stack else "(not specified)"
    ai_tools_str = ", ".join(ai_tools) if ai_tools else "(not specified)"

    nodes = []
    edges = []

    # 1. Product Overview
    nodes.append({
        "ref": "overview",
        "type": "Product Overview",
        "title": name,
        "x": 0, "y": 0,
        "content": (
            f"## What we're building\n{description or '(describe your product)'}\n\n"
            f"## Project kind\n`{project_kind}`\n\n"
            f"## Team size\n{team_size}\n\n"
            f"## AI tooling in use\n{ai_tools_str}"
        ),
    })

    # 2. Technical Architecture — populated from stack answer
    nodes.append({
        "ref": "arch",
        "type": "Technical Architecture",
        "title": "Stack & layout",
        "x": 320, "y": -100,
        "content": (
            f"## Stack\n{stack_str}\n\n"
            "## Components\n- (describe the layers here)\n\n"
            "## Data flow\nClient → API → DB"
        ),
    })

    # 3. AI Coding Rules — tailored to the AI tools selected
    rules_lines = [
        "## DO",
        "- Match the conventions of files already in the repository.",
        "- Write descriptive function names; prefer composition over inheritance.",
        "- Add types/schemas at every API boundary.",
        "",
        "## DO NOT",
        "- Invent new libraries when an existing one already covers it.",
        "- Re-implement abstractions that exist in the linked files.",
    ]
    if "Cursor" in ai_tools or "Claude Code" in ai_tools:
        rules_lines.extend([
            "",
            "## Cursor / Claude Code specifics",
            "- Reference the linked files when implementing changes.",
            "- Use the project graph in the agent context pack as authoritative.",
        ])
    if "Copilot" in ai_tools:
        rules_lines.extend([
            "",
            "## Copilot specifics",
            "- Prefer explicit imports over auto-suggested wildcards.",
        ])
    if "Autonomous agents" in ai_tools or "Devin" in ai_tools:
        rules_lines.extend([
            "",
            "## Autonomous agent specifics",
            "- After each task, run lint + tests; halt if either fails.",
            "- Open a PR rather than committing to main.",
        ])
    nodes.append({
        "ref": "rules",
        "type": "AI Coding Rules",
        "title": "Conventions",
        "x": 320, "y": 160,
        "content": "\n".join(rules_lines),
    })

    # 4. Feature Scope — one node per supplied feature (max 4)
    feature_refs = []
    for idx, feat in enumerate(features[:4]):
        ref = f"feature_{idx}"
        feature_refs.append(ref)
        # Layout: stagger right of Architecture
        x = 640 + (idx % 2) * 320
        y = -200 + (idx // 2) * 240
        nodes.append({
            "ref": ref,
            "type": "Feature Scope",
            "title": feat[:80],
            "x": x, "y": y,
            "content": (
                f"## Summary\n{feat}\n\n"
                "## Functional requirements\n- \n\n"
                "## Out of scope\n- "
            ),
        })

    if not feature_refs:
        # Always give at least a Feature Scope placeholder so the canvas isn't sparse.
        nodes.append({
            "ref": "feature_0",
            "type": "Feature Scope",
            "title": "First feature",
            "x": 640, "y": -200,
            "content": "## Summary\n(describe the first feature)\n\n## Functional requirements\n- ",
        })
        feature_refs.append("feature_0")

    # 5. DB Schema (only for stack types that imply a backend with DB)
    needs_db = any(
        s.lower() in {"postgres", "mongodb", "mysql", "prisma", "sqlalchemy", "drizzle"}
        for s in stack
    ) or project_kind in {"saas_app", "api_service", "mobile_app"}
    if needs_db:
        nodes.append({
            "ref": "db",
            "type": "Database Schema",
            "title": "Core entities",
            "x": 960, "y": 80,
            "content": (
                "## Entities\n```\nUser { id, email, createdAt }\n"
                "Resource { id, ownerId, ... }\n```\n\n"
                "## Relationships\n- User 1-N Resource"
            ),
        })

    # 6. API Contracts (always include for backend-y kinds)
    needs_api = project_kind in {"saas_app", "api_service", "mobile_app", "web_app"}
    if needs_api:
        nodes.append({
            "ref": "api",
            "type": "API Contracts",
            "title": "Endpoints",
            "x": 1280, "y": -80,
            "content": (
                "## Endpoints\n```\nGET    /api/resource\n"
                "POST   /api/resource\nGET    /api/resource/{id}\n```\n\n"
                "## Auth\nJWT bearer token"
            ),
        })

    # 7. UI Requirements (web/mobile)
    needs_ui = project_kind in {"saas_app", "web_app", "mobile_app"}
    if needs_ui:
        nodes.append({
            "ref": "ui",
            "type": "UI Requirements",
            "title": "Screens",
            "x": 960, "y": -320,
            "content": (
                "## Screens\n- \n\n## States\n- empty\n- loading\n- error\n- success"
            ),
        })

    # 8. Acceptance Criteria — one tied to each feature
    accept_refs = []
    for i, fref in enumerate(feature_refs):
        ref = f"accept_{i}"
        accept_refs.append((fref, ref))
        nodes.append({
            "ref": ref,
            "type": "Acceptance Criteria",
            "title": f"Acceptance · {next((n['title'] for n in nodes if n['ref'] == fref), '')[:40]}",
            "x": 1600, "y": -200 + i * 180,
            "content": (
                "## Given\n## When\n## Then\n\n"
                "- [ ] criterion 1\n- [ ] criterion 2"
            ),
        })

    # 9. Deployment Requirements
    deployment_label = {
        "vercel": "Vercel + managed Postgres",
        "aws": "AWS (EC2 / RDS / S3)",
        "docker": "Docker + self-host / k8s",
        "fly": "Fly.io",
        "railway": "Railway",
        "none": "n/a",
    }.get(deployment, deployment)
    if deployment != "none":
        nodes.append({
            "ref": "deploy",
            "type": "Deployment Requirements",
            "title": "Infra",
            "x": 640, "y": 420,
            "content": (
                f"## Target\n{deployment_label}\n\n"
                "## Environments\n- preview · staging · production\n\n"
                "## Secrets\n- DATABASE_URL\n- JWT_SECRET"
            ),
        })

    # 10. Testing Instructions — depth tuned to team size
    test_depth = {
        "solo": "Smoke-test the happy path. Skip exhaustive E2E.",
        "small": "Unit-test critical paths; one E2E per top-level feature.",
        "large": "Full test pyramid: unit + integration + E2E + load.",
    }.get(team_size, "Smoke-test the happy path.")
    nodes.append({
        "ref": "test",
        "type": "Testing Instructions",
        "title": "QA",
        "x": 1280, "y": 280,
        "content": (
            f"## Approach\n{test_depth}\n\n"
            "## Unit\n- \n\n## Integration\n- \n\n## E2E\n- "
        ),
    })

    # ---------- edges ----------
    # Overview → every feature
    for fref in feature_refs:
        edges.append(("overview", fref, "depends_on"))
        edges.append(("rules", fref, "constrains"))
    # Rules → arch
    edges.append(("rules", "arch", "constrains"))
    # Feature(s) → arch
    for fref in feature_refs:
        edges.append((fref, "arch", "depends_on"))
    # arch → db / api / ui
    if needs_db:
        edges.append(("arch", "db", "implements"))
    if needs_api:
        edges.append(("arch", "api", "implements"))
        if needs_db:
            edges.append(("api", "db", "depends_on"))
    if needs_ui:
        edges.append(("arch", "ui", "implements"))
    # feature → acceptance
    for fref, aref in accept_refs:
        edges.append((fref, aref, "produces"))
    # arch → deploy + features → test
    if deployment != "none":
        edges.append(("arch", "deploy", "depends_on"))
    for fref in feature_refs:
        edges.append((fref, "test", "produces"))

    return {"nodes": nodes, "edges": edges}
