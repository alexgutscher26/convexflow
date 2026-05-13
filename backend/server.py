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

from templates import TEMPLATES, TEMPLATE_META
from validation import validate_graph
from wizard import build_wizard_graph

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
    project_type: Literal["greenfield", "existing", "feature"] = "greenfield"
    template: str = "blank"  # "blank" | TEMPLATES key


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[Literal["greenfield", "existing", "feature"]] = None


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
    relationship_type: Literal[
        "depends_on", "constrains", "implements", "references", "produces"
    ] = "depends_on"


class SavePromptNodeReq(BaseModel):
    content: str
    title: str = "Generated Prompt"
    position_x: float = 0
    position_y: float = 0


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
    link_prior_prompts: bool = True


class ExportReq(BaseModel):
    format: Literal["markdown", "json", "agent_pack", "cursorrules"] = "markdown"


class SnapshotCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)


async def _capture_snapshot(
    project_id: str,
    kind: Literal["manual", "prompt", "export"],
    label: str,
    metadata: Optional[dict] = None,
) -> dict:
    """Freeze the current graph state into a snapshot document."""
    nodes = await db.nodes.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(2000)
    edges = await db.edges.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(5000)
    snap = {
        "id": new_id(),
        "project_id": project_id,
        "kind": kind,
        "label": label,
        "created_at": now_iso(),
        "nodes_data": nodes,
        "edges_data": edges,
        "metadata": metadata or {},
    }
    await db.snapshots.insert_one(snap)
    snap.pop("_id", None)
    return snap


def _summarize_snapshot(snap: dict) -> dict:
    """Return list-view summary without the heavy graph data."""
    return {
        "id": snap["id"],
        "project_id": snap["project_id"],
        "kind": snap["kind"],
        "label": snap["label"],
        "created_at": snap["created_at"],
        "nodes_count": len(snap.get("nodes_data") or []),
        "edges_count": len(snap.get("edges_data") or []),
        "metadata": snap.get("metadata") or {},
    }


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
    project_id = new_id()
    doc = {
        "id": project_id,
        "name": req.name,
        "description": req.description,
        "project_type": req.project_type,
        "template": req.template,
        "owner_id": user["id"],
        "repository": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.projects.insert_one(doc)

    # Seed graph from template (if not blank)
    tmpl = TEMPLATES.get(req.template)
    if tmpl:
        ref_to_id: dict[str, str] = {}
        node_docs = []
        for n in tmpl["nodes"]:
            nid = new_id()
            ref_to_id[n["ref"]] = nid
            node_docs.append({
                "id": nid,
                "project_id": project_id,
                "type": n["type"],
                "title": n["title"],
                "content": n["content"],
                "position_x": n["x"],
                "position_y": n["y"],
                "metadata": {"from_template": req.template},
                "file_references": [],
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        if node_docs:
            await db.nodes.insert_many(node_docs)
        edge_docs = []
        for src_ref, tgt_ref, rel in tmpl["edges"]:
            edge_docs.append({
                "id": new_id(),
                "project_id": project_id,
                "source_node_id": ref_to_id[src_ref],
                "target_node_id": ref_to_id[tgt_ref],
                "relationship_type": rel,
                "created_at": now_iso(),
            })
        if edge_docs:
            await db.edges.insert_many(edge_docs)

    doc.pop("_id", None)
    return doc


@api.get("/templates")
async def list_templates():
    return {"templates": [{"id": "blank", "label": "Blank", "description": "Empty canvas — build from scratch."}] + TEMPLATE_META}


class WizardReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    project_kind: Literal[
        "saas_app", "web_app", "api_service", "cli_tool", "mobile_app", "ai_ml"
    ] = "saas_app"
    stack: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    team_size: Literal["solo", "small", "large"] = "solo"
    ai_tools: list[str] = Field(default_factory=list)
    deployment: Literal["vercel", "aws", "docker", "fly", "railway", "none"] = "vercel"


@api.post("/wizard/generate")
async def wizard_generate(req: WizardReq, user: dict = Depends(get_current_user)):
    project_id = new_id()
    doc = {
        "id": project_id,
        "name": req.name,
        "description": req.description,
        "project_type": "greenfield",
        "template": "wizard",
        "owner_id": user["id"],
        "repository": None,
        "wizard_answers": req.model_dump(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.projects.insert_one(doc)

    graph = build_wizard_graph(req.model_dump())
    ref_to_id: dict[str, str] = {}
    node_docs = []
    for n in graph["nodes"]:
        nid = new_id()
        ref_to_id[n["ref"]] = nid
        node_docs.append({
            "id": nid,
            "project_id": project_id,
            "type": n["type"],
            "title": n["title"],
            "content": n["content"],
            "position_x": n["x"],
            "position_y": n["y"],
            "metadata": {"from_wizard": True},
            "file_references": [],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
    if node_docs:
        await db.nodes.insert_many(node_docs)

    edge_docs = []
    for src_ref, tgt_ref, rel in graph["edges"]:
        if src_ref not in ref_to_id or tgt_ref not in ref_to_id:
            continue
        edge_docs.append({
            "id": new_id(),
            "project_id": project_id,
            "source_node_id": ref_to_id[src_ref],
            "target_node_id": ref_to_id[tgt_ref],
            "relationship_type": rel,
            "created_at": now_iso(),
        })
    if edge_docs:
        await db.edges.insert_many(edge_docs)

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

    # Stale file-reference detection: walk every node, compare its
    # file_references against the freshly fetched tree, and stamp the node
    # metadata so the canvas can highlight stale links.
    new_paths = {t["path"] for t in raw_tree if t.get("type") == "blob"}
    stale_nodes_summary: list[dict] = []
    nodes_to_check = await db.nodes.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(2000)
    for n in nodes_to_check:
        refs = n.get("file_references") or []
        if not refs:
            # still clear any old stale marker
            md = n.get("metadata") or {}
            if md.get("stale_file_references"):
                md.pop("stale_file_references", None)
                md["last_rescan_at"] = now_iso()
                await db.nodes.update_one(
                    {"id": n["id"]},
                    {"$set": {"metadata": md, "updated_at": now_iso()}},
                )
            continue
        stale = [p for p in refs if p not in new_paths]
        md = n.get("metadata") or {}
        md["last_rescan_at"] = now_iso()
        if stale:
            md["stale_file_references"] = stale
            stale_nodes_summary.append({
                "node_id": n["id"],
                "title": n.get("title") or "(untitled)",
                "type": n.get("type"),
                "stale_paths": stale,
            })
        else:
            md.pop("stale_file_references", None)
        await db.nodes.update_one(
            {"id": n["id"]},
            {"$set": {"metadata": md, "updated_at": now_iso()}},
        )

    # Upsert a "GitHub Context" node so scan results show on the canvas.
    ctx_lines = [
        f"## Repository\n`{repo['owner']}/{repo['repo']}` · branch `{repo['branch']}`",
        "",
    ]
    if repo.get("frameworks"):
        ctx_lines.append("## Detected stack")
        for f in repo["frameworks"]:
            ctx_lines.append(f"- {f}")
        ctx_lines.append("")
    ctx_lines.append(f"## File tree\n`{len(file_tree)}` files indexed.")
    if readme:
        ctx_lines.append("")
        ctx_lines.append("## README excerpt")
        ctx_lines.append("```")
        ctx_lines.append(readme[:1500])
        ctx_lines.append("```")
    ctx_content = "\n".join(ctx_lines)

    existing = await db.nodes.find_one(
        {"project_id": project_id, "type": "GitHub Context"}, {"_id": 0}
    )
    if existing:
        await db.nodes.update_one(
            {"id": existing["id"]},
            {"$set": {"content": ctx_content, "updated_at": now_iso()}},
        )
    else:
        ctx_node = {
            "id": new_id(),
            "project_id": project_id,
            "type": "GitHub Context",
            "title": f"{repo['owner']}/{repo['repo']}",
            "content": ctx_content,
            "position_x": -260,
            "position_y": -120,
            "metadata": {"auto_generated": True},
            "file_references": [],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.nodes.insert_one(ctx_node)
    return {
        **repo,
        "stale_summary": {
            "count": len(stale_nodes_summary),
            "nodes": stale_nodes_summary,
        },
    }


# ---------- AI helpers (Claude Sonnet 4.5) ----------
NODE_TYPE_LIST = [
    "Product Overview", "Feature Scope", "User Stories", "Technical Architecture",
    "Database Schema", "API Contracts", "UI Requirements", "Acceptance Criteria",
    "AI Coding Rules", "File References", "Deployment Requirements",
    "Testing Instructions", "GitHub Context", "Prompt Output",
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


def _llm_error_to_http(e: Exception) -> HTTPException:
    """Convert LiteLLM / emergentintegrations errors into clear HTTP responses."""
    msg = str(e)
    low = msg.lower()
    if "budget" in low and "exceed" in low:
        return HTTPException(
            status_code=402,
            detail=(
                "Emergent Universal LLM key budget exhausted. "
                "Top up at Profile → Universal Key → Add Balance "
                "(or enable auto top-up) and retry."
            ),
        )
    if "rate" in low and "limit" in low:
        return HTTPException(
            status_code=429,
            detail="LLM rate limit hit. Wait a few seconds and retry.",
        )
    if "context" in low and ("length" in low or "window" in low or "token" in low):
        return HTTPException(
            status_code=413,
            detail=(
                "Prompt context too large for the model. Try disabling "
                "'Thread prior prompts' or focusing on fewer nodes."
            ),
        )
    if "timeout" in low or "timed out" in low:
        return HTTPException(
            status_code=504,
            detail="LLM upstream timed out. Try again with a smaller context.",
        )
    return HTTPException(status_code=502, detail=f"AI error: {msg[:300]}")


def _llm() -> LlmChat:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=new_id(),
        system_message=(
            "You are CortexFlow's architecture co-pilot. You help senior "
            "engineers design AI-native software. Output crisp, technical "
            "markdown. Avoid fluff and disclaimers. Use code fences for code.\n\n"
            "When the user provides project context (graph nodes, prior "
            "prompts, repository metadata), treat it as authoritative:\n"
            "- Do not contradict decisions already encoded in the graph.\n"
            "- Do not duplicate scope already covered by prior prompts.\n"
            "- Cite node titles when referencing existing components.\n"
            "- If extending a prior prompt, build on it explicitly; if "
            "  overriding, call out the change."
        ),
    ).with_model("anthropic", CLAUDE_MODEL)


@api.post("/ai/expand")
async def ai_expand(req: AIExpandReq, user: dict = Depends(get_current_user)):
    node = await db.nodes.find_one({"id": req.node_id}, {"_id": 0})
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    await assert_project_owner(node["project_id"], user["id"])

    # Pull ancestor nodes (1 hop upstream) for grounding.
    incoming = await db.edges.find(
        {"target_node_id": req.node_id}, {"_id": 0}
    ).to_list(50)
    ancestor_ids = [e["source_node_id"] for e in incoming]
    ancestors = []
    if ancestor_ids:
        ancestors = await db.nodes.find(
            {"id": {"$in": ancestor_ids}}, {"_id": 0}
        ).to_list(50)

    # Pull project repo + coding rules nodes for added context.
    project = await db.projects.find_one(
        {"id": node["project_id"]}, {"_id": 0}
    )
    repo = (project or {}).get("repository") or {}
    rules_nodes = await db.nodes.find(
        {"project_id": node["project_id"], "type": "AI Coding Rules"}, {"_id": 0}
    ).to_list(10)

    instruction = AI_INSTRUCTIONS.get(req.instruction, AI_INSTRUCTIONS["expand"])

    ctx_parts: list[str] = []
    if repo.get("frameworks"):
        ctx_parts.append(f"Detected stack: {', '.join(repo['frameworks'])}")
    if rules_nodes:
        ctx_parts.append("Project coding rules:")
        for r in rules_nodes:
            ctx_parts.append(r.get("content", "")[:600])
    if ancestors:
        ctx_parts.append("Upstream nodes (use as authoritative context):")
        for a in ancestors:
            ctx_parts.append(
                f"### [{a['type']}] {a.get('title', '')}\n{a.get('content', '')[:800]}"
            )
    ctx_block = "\n\n".join(ctx_parts) if ctx_parts else "(no additional context)"

    prompt = (
        f"# Task\n{instruction}\n\n"
        f"# Node type\n{node['type']}\n\n"
        f"# Node title\n{node.get('title', '')}\n\n"
        f"# Current content\n{node.get('content', '') or '(empty)'}\n\n"
        f"# Project context\n{ctx_block}\n\n"
        f"Return only the new markdown content. No preamble."
    )
    try:
        chat = _llm()
        reply = await chat.send_message(UserMessage(text=prompt))
    except HTTPException:
        raise
    except Exception as e:
        log.exception("AI expand failed")
        raise _llm_error_to_http(e)
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

    # Prior prompt snapshots so the new prompt threads on previous decisions.
    prior_prompts: list[dict] = []
    if req.link_prior_prompts:
        prior_snaps = await db.snapshots.find(
            {"project_id": project_id, "kind": "prompt"}, {"_id": 0}
        ).sort("created_at", -1).to_list(3)
        for s in prior_snaps:
            meta = s.get("metadata") or {}
            text = meta.get("prompt_text") or ""
            prior_prompts.append({
                "label": s.get("label"),
                "template": meta.get("prompt_template"),
                "extra_instructions": meta.get("extra_instructions"),
                "created_at": s.get("created_at"),
                "prompt_excerpt": text[:1500],
                "prompt_truncated": len(text) > 1500,
            })

    # Also surface any saved Prompt Output nodes — they are graph-pinned
    # versions of past prompts and live in the canvas itself.
    saved_prompt_nodes = [
        {"title": n.get("title"), "content_excerpt": (n.get("content") or "")[:1200]}
        for n in (by_type.get("Prompt Output") or [])
    ]

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
            for t, items in by_type.items() if t != "Prompt Output"
        },
        "saved_prompt_nodes_on_canvas": saved_prompt_nodes,
        "prior_prompts": prior_prompts,
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
        raise _llm_error_to_http(e)

    # Auto-snapshot: capture the graph + the generated prompt for replay.
    await _capture_snapshot(
        project_id,
        "prompt",
        f"Prompt · {req.template.replace('_', ' ')}",
        {
            "prompt_template": req.template,
            "prompt_text": reply,
            "extra_instructions": req.extra_instructions,
            "focus_node_ids": req.focus_node_ids,
        },
    )

    return {"prompt": reply, "template": req.template}


@api.post("/projects/{project_id}/save-prompt-node")
async def save_prompt_node(
    project_id: str,
    req: SavePromptNodeReq,
    user: dict = Depends(get_current_user),
):
    await assert_project_owner(project_id, user["id"])
    doc = {
        "id": new_id(),
        "project_id": project_id,
        "type": "Prompt Output",
        "title": req.title,
        "content": req.content,
        "position_x": req.position_x,
        "position_y": req.position_y,
        "metadata": {"generated": True},
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


# ---------- export ----------
def _build_cursorrules(project: dict, nodes: list[dict]) -> str:
    """Compile a Cursor-compatible .cursorrules file from a project graph.

    Pulls AI Coding Rules + Technical Architecture (primary), plus Database
    Schema, API Contracts and File References (supporting context). Frameworks
    detected from the connected repo are emitted as the stack header so Cursor
    sessions immediately know what tools to assume.
    """
    by_type: dict[str, list[dict]] = {}
    for n in nodes:
        by_type.setdefault(n["type"], []).append(n)

    repo = project.get("repository") or {}
    frameworks = repo.get("frameworks") or []

    project_name = project.get("name") or "this project"
    description = (project.get("description") or "").strip()

    lines: list[str] = []
    intro = f"You are an expert engineer working on {project_name}."
    if frameworks:
        intro += f" The stack is: {', '.join(frameworks)}."
    lines.append(intro)
    if description:
        lines.append("")
        lines.append(description)
    lines.append("")
    lines.append(
        "Treat the sections below as binding project intelligence — do not "
        "contradict the architecture, conventions, or constraints encoded here. "
        "Cite node titles when referencing existing components."
    )
    lines.append("")

    def _emit(section_title: str, items: list[dict], fallback: str = "") -> None:
        if not items and not fallback:
            return
        lines.append(f"# {section_title}")
        if not items:
            lines.append(fallback)
            lines.append("")
            return
        for it in items:
            title = (it.get("title") or "").strip() or "(untitled)"
            content = (it.get("content") or "").strip()
            lines.append(f"## {title}")
            if content:
                lines.append(content)
            else:
                lines.append("_(no content)_")
            lines.append("")

    # Stack block — repo metadata first, then explicit stack/architecture nodes
    if frameworks:
        lines.append("# Stack")
        for f in frameworks:
            lines.append(f"- {f}")
        if repo.get("owner") and repo.get("repo"):
            lines.append(
                f"- Repo: `{repo['owner']}/{repo['repo']}` "
                f"(branch `{repo.get('branch', 'main')}`)"
            )
        lines.append("")

    _emit("Technical Architecture", by_type.get("Technical Architecture") or [])
    _emit("Database Schema", by_type.get("Database Schema") or [])
    _emit("API Contracts", by_type.get("API Contracts") or [])
    _emit("Coding Rules & Conventions", by_type.get("AI Coding Rules") or [])
    _emit("Testing Conventions", by_type.get("Testing Instructions") or [])

    # Pinned file references (deduped) — Cursor picks these up as hints
    all_refs: list[str] = []
    seen: set[str] = set()
    for n in nodes:
        for f in n.get("file_references") or []:
            stale = (n.get("metadata") or {}).get("stale_file_references") or []
            if f in seen or f in stale:
                continue
            seen.add(f)
            all_refs.append(f)
    if all_refs:
        lines.append("# Key Files")
        lines.append(
            "These files are referenced by the project graph — read them "
            "before modifying related code."
        )
        for f in all_refs:
            lines.append(f"- `{f}`")
        lines.append("")

    lines.append("# When generating code")
    lines.append(
        "- Follow the architecture and conventions above; do not introduce "
        "stack choices not listed in `# Stack`."
    )
    lines.append(
        "- Reference exact file paths from `# Key Files` when they exist; "
        "do not invent paths."
    )
    lines.append(
        "- Add or update tests for any new behaviour, mirroring the style "
        "documented in `# Testing Conventions`."
    )
    lines.append(
        "- If a request conflicts with this file, surface the conflict "
        "explicitly instead of silently overriding."
    )
    lines.append("")
    lines.append(
        f"<!-- Generated by CortexFlow from project: {project_name} -->"
    )

    return "\n".join(lines).rstrip() + "\n"


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
        result = {
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
        await _capture_snapshot(
            project_id, "export", "Export · json",
            {"export_format": "json", "export_content": result["content"]},
        )
        return result

    if req.format == "cursorrules":
        cursorrules = _build_cursorrules(project, nodes)
        await _capture_snapshot(
            project_id, "export", "Export · cursorrules",
            {"export_format": "cursorrules", "export_content": cursorrules},
        )
        return {"format": "cursorrules", "content": cursorrules}

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
        await _capture_snapshot(
            project_id, "export", "Export · agent_pack",
            {"export_format": "agent_pack", "export_content": agent_pack},
        )
        return {"format": "agent_pack", "content": agent_pack}

    await _capture_snapshot(
        project_id, "export", "Export · markdown",
        {"export_format": "markdown", "export_content": markdown},
    )
    return {"format": "markdown", "content": markdown}


@api.post("/projects/{project_id}/validate")
async def validate_project(
    project_id: str, user: dict = Depends(get_current_user)
):
    await assert_project_owner(project_id, user["id"])
    nodes = await db.nodes.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(2000)
    edges = await db.edges.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(5000)
    return validate_graph(nodes, edges)


@api.get("/projects/{project_id}/prompt-history-count")
async def prompt_history_count(
    project_id: str, user: dict = Depends(get_current_user)
):
    await assert_project_owner(project_id, user["id"])
    count = await db.snapshots.count_documents(
        {"project_id": project_id, "kind": "prompt"}
    )
    saved = await db.nodes.count_documents(
        {"project_id": project_id, "type": "Prompt Output"}
    )
    return {"prior_prompts": count, "saved_prompt_nodes": saved}


# ---------- snapshots / history / diff ----------
@api.post("/projects/{project_id}/snapshots")
async def manual_snapshot(
    project_id: str,
    req: SnapshotCreate,
    user: dict = Depends(get_current_user),
):
    await assert_project_owner(project_id, user["id"])
    snap = await _capture_snapshot(project_id, "manual", req.label, {})
    return _summarize_snapshot(snap)


@api.get("/projects/{project_id}/snapshots")
async def list_snapshots(
    project_id: str, user: dict = Depends(get_current_user)
):
    await assert_project_owner(project_id, user["id"])
    items = await db.snapshots.find(
        {"project_id": project_id}, {"_id": 0, "nodes_data": 0, "edges_data": 0}
    ).sort("created_at", -1).to_list(500)
    return [_summarize_snapshot({**i, "nodes_data": [], "edges_data": []}) | {
        "nodes_count": i.get("metadata", {}).get("_nodes_count", 0),
        "edges_count": i.get("metadata", {}).get("_edges_count", 0),
    } for i in items]


@api.get("/snapshots/{snapshot_id}")
async def get_snapshot(snapshot_id: str, user: dict = Depends(get_current_user)):
    snap = await db.snapshots.find_one({"id": snapshot_id}, {"_id": 0})
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    await assert_project_owner(snap["project_id"], user["id"])
    return snap


@api.delete("/snapshots/{snapshot_id}")
async def delete_snapshot(
    snapshot_id: str, user: dict = Depends(get_current_user)
):
    snap = await db.snapshots.find_one({"id": snapshot_id}, {"_id": 0})
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    await assert_project_owner(snap["project_id"], user["id"])
    await db.snapshots.delete_one({"id": snapshot_id})
    return {"ok": True}


def _diff_graphs(a_nodes: list[dict], a_edges: list[dict],
                 b_nodes: list[dict], b_edges: list[dict]) -> dict:
    a_node_idx = {n["id"]: n for n in a_nodes}
    b_node_idx = {n["id"]: n for n in b_nodes}
    added_nodes = [b_node_idx[i] for i in b_node_idx if i not in a_node_idx]
    removed_nodes = [a_node_idx[i] for i in a_node_idx if i not in b_node_idx]
    modified_nodes = []
    for nid in a_node_idx.keys() & b_node_idx.keys():
        a_n, b_n = a_node_idx[nid], b_node_idx[nid]
        changed_fields = []
        for f in ("type", "title", "content"):
            if (a_n.get(f) or "") != (b_n.get(f) or ""):
                changed_fields.append(f)
        ref_a = set(a_n.get("file_references") or [])
        ref_b = set(b_n.get("file_references") or [])
        if ref_a != ref_b:
            changed_fields.append("file_references")
        if changed_fields:
            modified_nodes.append({
                "id": nid,
                "type": b_n.get("type"),
                "title_before": a_n.get("title"),
                "title_after": b_n.get("title"),
                "content_before": a_n.get("content", ""),
                "content_after": b_n.get("content", ""),
                "file_references_before": sorted(ref_a),
                "file_references_after": sorted(ref_b),
                "changed_fields": changed_fields,
            })

    def edge_key(e):
        return f"{e['source_node_id']}|{e['target_node_id']}|{e.get('relationship_type', 'depends_on')}"

    a_edge_keys = {edge_key(e): e for e in a_edges}
    b_edge_keys = {edge_key(e): e for e in b_edges}
    added_edges = [b_edge_keys[k] for k in b_edge_keys if k not in a_edge_keys]
    removed_edges = [a_edge_keys[k] for k in a_edge_keys if k not in b_edge_keys]

    return {
        "added_nodes": added_nodes,
        "removed_nodes": removed_nodes,
        "modified_nodes": modified_nodes,
        "added_edges": added_edges,
        "removed_edges": removed_edges,
        "summary": {
            "nodes_added": len(added_nodes),
            "nodes_removed": len(removed_nodes),
            "nodes_modified": len(modified_nodes),
            "edges_added": len(added_edges),
            "edges_removed": len(removed_edges),
        },
    }


@api.get("/snapshots/{a_id}/diff/{b_id}")
async def diff_snapshots(
    a_id: str, b_id: str, user: dict = Depends(get_current_user)
):
    a = await db.snapshots.find_one({"id": a_id}, {"_id": 0})
    b = await db.snapshots.find_one({"id": b_id}, {"_id": 0})
    if not a or not b:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    if a["project_id"] != b["project_id"]:
        raise HTTPException(status_code=400, detail="Snapshots from different projects")
    await assert_project_owner(a["project_id"], user["id"])
    diff = _diff_graphs(
        a.get("nodes_data") or [], a.get("edges_data") or [],
        b.get("nodes_data") or [], b.get("edges_data") or [],
    )
    return {
        "before": {"id": a["id"], "label": a["label"], "kind": a["kind"], "created_at": a["created_at"]},
        "after": {"id": b["id"], "label": b["label"], "kind": b["kind"], "created_at": b["created_at"]},
        "diff": diff,
    }


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
