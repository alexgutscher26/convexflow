"""CortexFlow MVP backend.

FastAPI + MongoDB. JWT-auth, projects, nodes, edges, GitHub PAT-based repo
sync, Claude Sonnet 4.5 powered AI helpers, and PRD export.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_DAYS = int(os.environ.get("JWT_EXPIRY_DAYS", "30"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="CortexFlow API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("cortexflow")


# ---------- helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def assert_project_owner(project_id: str, user_id: str) -> dict:
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return project


# ---------- models ----------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class TokenResp(BaseModel):
    token: str
    user: dict


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None


class NodeIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str
    title: str = ""
    content: str = ""
    position_x: float = 0
    position_y: float = 0
    metadata: dict = Field(default_factory=dict)


class NodeUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    content: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    metadata: Optional[dict] = None
    file_references: Optional[list[str]] = None


class EdgeIn(BaseModel):
    source_node_id: str
    target_node_id: str
    relationship_type: str = "depends_on"


class RepoConnect(BaseModel):
    owner: str
    repo: str
    branch: str = "main"
    pat: str = ""  # optional, public repos work without


class AIExpandReq(BaseModel):
    node_id: str
    instruction: Literal[
        "expand", "acceptance_criteria", "implementation_plan", "missing_constraints",
        "api_schema", "test_plan",
    ] = "expand"


class AIPromptReq(BaseModel):
    template: Literal[
        "feature_implementation", "refactor", "bug_fix", "testing",
        "migration", "architecture",
    ] = "feature_implementation"
    focus_node_ids: list[str] = Field(default_factory=list)
    extra_instructions: str = ""


class ExportReq(BaseModel):
    format: Literal["markdown", "json", "agent_pack"] = "markdown"


# ---------- auth ----------
@api.post("/auth/register", response_model=TokenResp)
async def register(req: RegisterReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = new_id()
    doc = {
        "id": user_id,
        "email": req.email.lower(),
        "name": req.name,
        "password_hash": hash_password(req.password),
        "created_at": now_iso(),
        "github_pat": "",  # user-stored PAT (optional)
    }
    await db.users.insert_one(doc)
    safe = {"id": user_id, "email": doc["email"], "name": doc["name"]}
    return {"token": create_token(user_id), "user": safe}


@api.post("/auth/login", response_model=TokenResp)
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    safe = {"id": user["id"], "email": user["email"], "name": user["name"]}
    return {"token": create_token(user["id"]), "user": safe}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- projects ----------
@api.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    items = await db.projects.find(
        {"owner_id": user["id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(200)
    return items


@api.post("/projects")
async def create_project(req: ProjectCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        "name": req.name,
        "description": req.description,
        "owner_id": user["id"],
        "repository": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    return await assert_project_owner(project_id, user["id"])


@api.put("/projects/{project_id}")
async def update_project(
    project_id: str, req: ProjectUpdate, user: dict = Depends(get_current_user)
):
    await assert_project_owner(project_id, user["id"])
    patch: dict[str, Any] = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    patch["updated_at"] = now_iso()
    await db.projects.update_one({"id": project_id}, {"$set": patch})
    return await db.projects.find_one({"id": project_id}, {"_id": 0})


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    await assert_project_owner(project_id, user["id"])
    await db.projects.delete_one({"id": project_id})
    await db.nodes.delete_many({"project_id": project_id})
    await db.edges.delete_many({"project_id": project_id})
    return {"ok": True}


# ---------- nodes ----------
@api.get("/projects/{project_id}/nodes")
async def list_nodes(project_id: str, user: dict = Depends(get_current_user)):
    await assert_project_owner(project_id, user["id"])
    return await db.nodes.find({"project_id": project_id}, {"_id": 0}).to_list(2000)


@api.post("/projects/{project_id}/nodes")
async def create_node(
    project_id: str, req: NodeIn, user: dict = Depends(get_current_user)
):
    await assert_project_owner(project_id, user["id"])
    doc = {
        "id": new_id(),
        "project_id": project_id,
        "type": req.type,
        "title": req.title or req.type,
        "content": req.content,
        "position_x": req.position_x,
        "position_y": req.position_y,
        "metadata": req.metadata,
        "file_references": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.nodes.insert_one(doc)
    await db.projects.update_one(
        {"id": project_id}, {"$set": {"updated_at": now_iso()}}
    )
    doc.pop("_id", None)
    return doc


@api.put("/nodes/{node_id}")
async def update_node(
    node_id: str, req: NodeUpdate, user: dict = Depends(get_current_user)
):
    node = await db.nodes.find_one({"id": node_id}, {"_id": 0})
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    await assert_project_owner(node["project_id"], user["id"])
    patch = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    patch["updated_at"] = now_iso()
    await db.nodes.update_one({"id": node_id}, {"$set": patch})
    await db.projects.update_one(
        {"id": node["project_id"]}, {"$set": {"updated_at": now_iso()}}
    )
    return await db.nodes.find_one({"id": node_id}, {"_id": 0})


@api.delete("/nodes/{node_id}")
async def delete_node(node_id: str, user: dict = Depends(get_current_user)):
    node = await db.nodes.find_one({"id": node_id}, {"_id": 0})
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    await assert_project_owner(node["project_id"], user["id"])
    await db.nodes.delete_one({"id": node_id})
    await db.edges.delete_many({
        "$or": [{"source_node_id": node_id}, {"target_node_id": node_id}]
    })
    return {"ok": True}


# ---------- edges ----------
@api.get("/projects/{project_id}/edges")
async def list_edges(project_id: str, user: dict = Depends(get_current_user)):
    await assert_project_owner(project_id, user["id"])
    return await db.edges.find({"project_id": project_id}, {"_id": 0}).to_list(5000)


@api.post("/projects/{project_id}/edges")
async def create_edge(
    project_id: str, req: EdgeIn, user: dict = Depends(get_current_user)
):
    await assert_project_owner(project_id, user["id"])
    doc = {
        "id": new_id(),
        "project_id": project_id,
        "source_node_id": req.source_node_id,
        "target_node_id": req.target_node_id,
        "relationship_type": req.relationship_type,
        "created_at": now_iso(),
    }
    await db.edges.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/edges/{edge_id}")
async def delete_edge(edge_id: str, user: dict = Depends(get_current_user)):
    edge = await db.edges.find_one({"id": edge_id}, {"_id": 0})
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    await assert_project_owner(edge["project_id"], user["id"])
    await db.edges.delete_one({"id": edge_id})
    return {"ok": True}


# ---------- github repo sync ----------
FRAMEWORK_SIGNALS = {
    "package.json": {"keys": {
        "next": "Next.js", "react": "React", "vue": "Vue", "svelte": "Svelte",
        "express": "Express", "@nestjs/core": "NestJS", "prisma": "Prisma",
        "jest": "Jest", "playwright": "Playwright", "vitest": "Vitest",
        "tailwindcss": "Tailwind CSS", "@types/node": "Node.js",
    }},
    "requirements.txt": {"keys": {
        "fastapi": "FastAPI", "flask": "Flask", "django": "Django",
        "sqlalchemy": "SQLAlchemy", "pytest": "PyTest", "motor": "Motor/MongoDB",
        "pymongo": "MongoDB",
    }},
    "pyproject.toml": {"keys": {
        "fastapi": "FastAPI", "django": "Django", "poetry": "Poetry",
    }},
    "Dockerfile": {"keys": {"dockerfile": "Docker"}},
    "docker-compose.yml": {"keys": {"docker-compose": "Docker Compose"}},
    "next.config.js": {"keys": {"next.config": "Next.js"}},
    "vite.config.js": {"keys": {"vite": "Vite"}},
    "vite.config.ts": {"keys": {"vite": "Vite"}},
    "tailwind.config.js": {"keys": {"tailwind": "Tailwind CSS"}},
    "prisma/schema.prisma": {"keys": {"prisma": "Prisma"}},
}


async def github_get(url: str, pat: str) -> Any:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "CortexFlow"}
    if pat:
        headers["Authorization"] = f"Bearer {pat}"
    async with httpx.AsyncClient(timeout=20) as cx:
        r = await cx.get(url, headers=headers)
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Repository or branch not found")
    if r.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid GitHub token")
    if r.status_code == 403:
        raise HTTPException(status_code=403, detail="GitHub rate limit or access denied")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"GitHub error: {r.text[:200]}")
    return r.json()


@api.post("/projects/{project_id}/repository")
async def connect_repo(
    project_id: str, req: RepoConnect, user: dict = Depends(get_current_user)
):
    await assert_project_owner(project_id, user["id"])
    # verify accessible
    info = await github_get(
        f"https://api.github.com/repos/{req.owner}/{req.repo}", req.pat
    )
    repo_doc = {
        "github_repo_id": str(info.get("id", "")),
        "owner": req.owner,
        "repo": req.repo,
        "branch": req.branch or info.get("default_branch") or "main",
        "description": info.get("description") or "",
        "html_url": info.get("html_url"),
        "stars": info.get("stargazers_count", 0),
        "language": info.get("language"),
        "pat_stored": bool(req.pat),
        "connected_at": now_iso(),
        "file_tree": [],
        "frameworks": [],
        "readme_excerpt": "",
    }
    # store PAT on user record (encrypted-at-rest in production; MVP plaintext)
    if req.pat:
        await db.users.update_one(
            {"id": user["id"]}, {"$set": {"github_pat": req.pat}}
        )
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"repository": repo_doc, "updated_at": now_iso()}},
    )
    return repo_doc


@api.post("/projects/{project_id}/repository/scan")
async def scan_repo(project_id: str, user: dict = Depends(get_current_user)):
    project = await assert_project_owner(project_id, user["id"])
    repo = project.get("repository")
    if not repo:
        raise HTTPException(status_code=400, detail="No repository connected")
    user_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    pat = user_doc.get("github_pat", "") if user_doc else ""

    branch = repo["branch"]
    owner, name = repo["owner"], repo["repo"]

    # fetch tree (recursive)
    tree_resp = await github_get(
        f"https://api.github.com/repos/{owner}/{name}/git/trees/{branch}?recursive=1",
        pat,
    )
    raw_tree = tree_resp.get("tree", [])
    file_tree = [
        {"path": t["path"], "type": t["type"], "size": t.get("size", 0)}
        for t in raw_tree[:2000]
    ]

    # detect frameworks
    detected: set[str] = set()
    paths_set = {t["path"] for t in raw_tree}
    for signal_file, cfg in FRAMEWORK_SIGNALS.items():
        if signal_file in paths_set:
            if signal_file in {"Dockerfile", "docker-compose.yml"}:
                detected.update(cfg["keys"].values())
                continue
            try:
                contents = await github_get(
                    f"https://api.github.com/repos/{owner}/{name}/contents/{signal_file}?ref={branch}",
                    pat,
                )
                import base64
                raw = base64.b64decode(contents.get("content", "")).decode(
                    "utf-8", errors="ignore"
                ).lower()
                for key, label in cfg["keys"].items():
                    if key in raw:
                        detected.add(label)
            except HTTPException:
                continue

    # README excerpt
    readme = ""
    for cand in ["README.md", "Readme.md", "readme.md"]:
        if cand in paths_set:
            try:
                contents = await github_get(
                    f"https://api.github.com/repos/{owner}/{name}/contents/{cand}?ref={branch}",
                    pat,
                )
                import base64
                readme = base64.b64decode(contents.get("content", "")).decode(
                    "utf-8", errors="ignore"
                )[:2500]
                break
            except HTTPException:
                continue

    repo.update({
        "file_tree": file_tree,
        "frameworks": sorted(detected),
        "readme_excerpt": readme,
        "scanned_at": now_iso(),
    })
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"repository": repo, "updated_at": now_iso()}},
    )
    return repo


# ---------- AI helpers (Claude Sonnet 4.5) ----------
NODE_TYPE_LIST = [
    "Product Overview", "Feature Scope", "User Stories", "Technical Architecture",
    "Database Schema", "API Contracts", "UI Requirements", "Acceptance Criteria",
    "AI Coding Rules", "File References", "Deployment Requirements",
    "Testing Instructions",
]

AI_INSTRUCTIONS = {
    "expand": "Expand and enrich the content of this node. Write in concise, "
              "technical markdown. Add concrete details, constraints, and "
              "structured sub-sections.",
    "acceptance_criteria": "Generate a comprehensive list of acceptance "
                           "criteria as Given/When/Then bullets in markdown.",
    "implementation_plan": "Generate a step-by-step implementation plan in "
                           "markdown with file paths, code touchpoints, and "
                           "validation checkpoints.",
    "missing_constraints": "Detect and list missing technical constraints, "
                           "edge cases, or architectural concerns for this node.",
    "api_schema": "Suggest a concrete REST or GraphQL API schema relevant to "
                  "this node in fenced code blocks.",
    "test_plan": "Generate a structured test plan covering unit, integration, "
                 "and e2e cases in markdown.",
}


def _llm() -> LlmChat:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=new_id(),
        system_message=(
            "You are CortexFlow's architecture co-pilot. You help senior "
            "engineers design AI-native software. Output crisp, technical "
            "markdown. Avoid fluff and disclaimers. Use code fences for code."
        ),
    ).with_model("anthropic", CLAUDE_MODEL)


@api.post("/ai/expand")
async def ai_expand(req: AIExpandReq, user: dict = Depends(get_current_user)):
    node = await db.nodes.find_one({"id": req.node_id}, {"_id": 0})
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    await assert_project_owner(node["project_id"], user["id"])

    instruction = AI_INSTRUCTIONS.get(req.instruction, AI_INSTRUCTIONS["expand"])
    prompt = (
        f"# Task\n{instruction}\n\n"
        f"# Node type\n{node['type']}\n\n"
        f"# Node title\n{node.get('title', '')}\n\n"
        f"# Current content\n{node.get('content', '') or '(empty)'}\n\n"
        f"Return only the new markdown content. No preamble."
    )
    try:
        chat = _llm()
        reply = await chat.send_message(UserMessage(text=prompt))
    except HTTPException:
        raise
    except Exception as e:
        log.exception("AI expand failed")
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    return {"content": reply}


@api.post("/projects/{project_id}/ai/generate-prompt")
async def ai_generate_prompt(
    project_id: str, req: AIPromptReq, user: dict = Depends(get_current_user)
):
    project = await assert_project_owner(project_id, user["id"])
    nodes = await db.nodes.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(2000)
    edges = await db.edges.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(5000)

    by_type: dict[str, list[dict]] = {}
    for n in nodes:
        by_type.setdefault(n["type"], []).append(n)

    repo = project.get("repository") or {}
    frameworks = repo.get("frameworks") or []
    referenced_files: list[str] = []
    if req.focus_node_ids:
        focus_set = set(req.focus_node_ids)
        for n in nodes:
            if n["id"] in focus_set:
                referenced_files.extend(n.get("file_references", []) or [])
    else:
        for n in nodes:
            referenced_files.extend(n.get("file_references", []) or [])

    context = {
        "project": {"name": project["name"], "description": project["description"]},
        "stack": frameworks,
        "repository": {
            "owner": repo.get("owner"), "repo": repo.get("repo"),
            "branch": repo.get("branch"),
        } if repo else None,
        "referenced_files": sorted(set(referenced_files)),
        "nodes_by_type": {
            t: [{"title": n["title"], "content": n["content"]} for n in items]
            for t, items in by_type.items()
        },
        "edge_count": len(edges),
    }

    template_briefs = {
        "feature_implementation": "Generate an implementation prompt for a new feature.",
        "refactor": "Generate a prompt to refactor existing code safely.",
        "bug_fix": "Generate a prompt to isolate and fix a bug.",
        "testing": "Generate a prompt to create tests.",
        "migration": "Generate a prompt for a framework/database migration.",
        "architecture": "Generate an architecture-planning prompt.",
    }
    brief = template_briefs.get(req.template, template_briefs["feature_implementation"])

    import json as _json
    prompt = (
        f"# Task\n{brief}\n\n"
        "Output a single self-contained markdown prompt suitable for pasting "
        "into Cursor / GitHub Copilot Chat / Claude Code. Structure the "
        "output with these H2 sections in order:\n"
        "## Objective\n## Repository Context\n## Constraints\n"
        "## Required Deliverables\n## Validation Requirements\n## Output Format\n\n"
        "Use the structured project graph below to ground every section.\n\n"
        f"## Extra user instructions\n{req.extra_instructions or '(none)'}\n\n"
        f"## Project graph (JSON)\n```json\n{_json.dumps(context, indent=2)[:12000]}\n```\n"
        "Return ONLY the final prompt markdown. No preamble."
    )
    try:
        chat = _llm()
        reply = await chat.send_message(UserMessage(text=prompt))
    except HTTPException:
        raise
    except Exception as e:
        log.exception("AI prompt generation failed")
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    return {"prompt": reply, "template": req.template}


# ---------- export ----------
@api.post("/projects/{project_id}/export")
async def export_project(
    project_id: str, req: ExportReq, user: dict = Depends(get_current_user)
):
    project = await assert_project_owner(project_id, user["id"])
    nodes = await db.nodes.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(2000)
    edges = await db.edges.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(5000)

    if req.format == "json":
        return {
            "format": "json",
            "content": {
                "project": {
                    "id": project["id"], "name": project["name"],
                    "description": project["description"],
                    "repository": project.get("repository"),
                },
                "nodes": nodes,
                "edges": edges,
            },
        }

    # markdown / agent_pack share a base
    lines: list[str] = []
    lines.append(f"# {project['name']}")
    lines.append("")
    if project.get("description"):
        lines.append(project["description"])
        lines.append("")
    repo = project.get("repository") or {}
    if repo:
        lines.append("## Repository")
        lines.append(f"- **Repo**: `{repo.get('owner')}/{repo.get('repo')}` (branch: `{repo.get('branch')}`)")
        if repo.get("frameworks"):
            lines.append(f"- **Detected stack**: {', '.join(repo['frameworks'])}")
        lines.append("")

    by_type: dict[str, list[dict]] = {}
    for n in nodes:
        by_type.setdefault(n["type"], []).append(n)

    for ntype in NODE_TYPE_LIST:
        if ntype not in by_type:
            continue
        lines.append(f"## {ntype}")
        for n in by_type[ntype]:
            lines.append(f"### {n.get('title') or '(untitled)'}")
            if n.get("content"):
                lines.append(n["content"])
            if n.get("file_references"):
                lines.append("")
                lines.append("**Referenced files:**")
                for f in n["file_references"]:
                    lines.append(f"- `{f}`")
            lines.append("")

    if edges:
        lines.append("## Relationships")
        node_index = {n["id"]: n for n in nodes}
        for e in edges:
            s = node_index.get(e["source_node_id"], {}).get("title", "?")
            t = node_index.get(e["target_node_id"], {}).get("title", "?")
            lines.append(f"- `{s}` → `{t}` ({e['relationship_type']})")

    markdown = "\n".join(lines)

    if req.format == "agent_pack":
        agent_pack = (
            "# CortexFlow Agent Context Pack\n\n"
            "You are working on the project described below. Treat this as "
            "binding project intelligence: follow the architecture, constraints, "
            "and conventions. Reference linked files when implementing.\n\n"
            + markdown
        )
        return {"format": "agent_pack", "content": agent_pack}

    return {"format": "markdown", "content": markdown}


# ---------- meta ----------
@api.get("/node-types")
async def node_types():
    return {"types": NODE_TYPE_LIST}


@api.get("/")
async def root():
    return {"service": "cortexflow", "ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
