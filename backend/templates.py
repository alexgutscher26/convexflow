"""Starter graph templates for new projects.

Each template defines a list of nodes (with relative positions and pre-filled
content) plus a list of edges identified by node ``ref`` aliases. The aliases
are resolved to real node IDs during project creation.
"""
from __future__ import annotations


SAAS_APP = {
    "label": "SaaS App",
    "description": "Web SaaS with auth, billing, multi-tenant workspace.",
    "nodes": [
        {
            "ref": "overview",
            "type": "Product Overview",
            "title": "Product Overview",
            "x": 0, "y": 0,
            "content": (
                "## Vision\nA multi-tenant SaaS product with subscription billing.\n\n"
                "## Goals\n- Self-serve signup\n- Stripe-powered billing\n- Per-workspace data isolation\n\n"
                "## Target users\n- Small SaaS teams\n\n"
                "## Non-goals\n- Custom on-prem deployments in v1"
            ),
        },
        {
            "ref": "feature",
            "type": "Feature Scope",
            "title": "Auth + Workspaces + Billing",
            "x": 320, "y": -120,
            "content": (
                "## Summary\nEmail/OAuth auth, multi-workspace, Stripe subscriptions.\n\n"
                "## Functional requirements\n- Email/password + GitHub OAuth\n"
                "- Workspace creation with role-based members\n"
                "- Stripe Checkout + customer portal\n\n"
                "## Out of scope\n- SSO / SAML\n- Usage-based metering"
            ),
        },
        {
            "ref": "rules",
            "type": "AI Coding Rules",
            "title": "Conventions",
            "x": 320, "y": 140,
            "content": (
                "## DO\n- TypeScript strict mode\n- Zod-validate every API input\n"
                "- bcrypt cost 12 for passwords\n- Prisma for all DB access\n\n"
                "## DO NOT\n- Use `any` types\n- Store secrets in client state\n"
                "- Bypass middleware auth checks"
            ),
        },
        {
            "ref": "arch",
            "type": "Technical Architecture",
            "title": "Stack",
            "x": 640, "y": -200,
            "content": (
                "## Components\n- Next.js 14 App Router (web)\n- Prisma + PostgreSQL\n"
                "- Stripe SDK for billing\n- next-auth v5 sessions\n\n"
                "## Data flow\nBrowser → Next API routes → Prisma → Postgres\n\n"
                "## Trade-offs\n- Monolith Next app for MVP velocity"
            ),
        },
        {
            "ref": "db",
            "type": "Database Schema",
            "title": "Core entities",
            "x": 960, "y": -260,
            "content": (
                "## Entities\n```\nUser { id, email, passwordHash, createdAt }\n"
                "Workspace { id, name, ownerId }\n"
                "Membership { userId, workspaceId, role }\n"
                "Subscription { workspaceId, stripeCustomerId, status, plan }\n```\n\n"
                "## Relationships\n- User 1-N Workspace (owner)\n- Workspace N-N User via Membership"
            ),
        },
        {
            "ref": "api",
            "type": "API Contracts",
            "title": "REST endpoints",
            "x": 960, "y": -40,
            "content": (
                "## Endpoints\n```\nPOST /api/auth/register\nPOST /api/auth/login\n"
                "GET  /api/workspaces\nPOST /api/workspaces\n"
                "POST /api/billing/checkout\nPOST /api/billing/webhook\n```\n\n"
                "## Auth\nJWT session cookie\n\n## Errors\n- 401 unauthenticated\n- 402 payment required"
            ),
        },
        {
            "ref": "ui",
            "type": "UI Requirements",
            "title": "Screens",
            "x": 640, "y": 100,
            "content": (
                "## Screens\n- Marketing landing\n- Login / Register\n- Workspace dashboard\n"
                "- Billing settings\n- Team members\n\n## States\n- Logged out\n- Trialing\n- Active\n- Past due"
            ),
        },
        {
            "ref": "deploy",
            "type": "Deployment Requirements",
            "title": "Infra",
            "x": 640, "y": 360,
            "content": (
                "## Environments\n- preview (PR) · staging · production\n\n"
                "## Pipeline\n- Vercel for web\n- Neon for Postgres\n- Stripe live keys in prod only\n\n"
                "## Secrets\n- STRIPE_SECRET_KEY\n- DATABASE_URL\n- NEXTAUTH_SECRET"
            ),
        },
        {
            "ref": "test",
            "type": "Testing Instructions",
            "title": "QA",
            "x": 960, "y": 220,
            "content": (
                "## Unit tests\n- Password hashing boundary\n- Subscription status transitions\n\n"
                "## Integration\n- Stripe webhook signature verification\n\n"
                "## E2E\n- Signup → checkout → workspace creation → invite member"
            ),
        },
    ],
    "edges": [
        ("overview", "feature", "depends_on"),
        ("rules", "feature", "constrains"),
        ("rules", "arch", "constrains"),
        ("feature", "arch", "depends_on"),
        ("arch", "db", "implements"),
        ("arch", "api", "implements"),
        ("feature", "ui", "depends_on"),
        ("arch", "deploy", "depends_on"),
        ("feature", "test", "produces"),
    ],
}


CLI_TOOL = {
    "label": "CLI Tool",
    "description": "Command-line tool with multiple subcommands.",
    "nodes": [
        {
            "ref": "overview",
            "type": "Product Overview",
            "title": "Product Overview",
            "x": 0, "y": 0,
            "content": (
                "## Vision\nA fast, composable command-line tool.\n\n"
                "## Goals\n- Single static binary\n- Pipe-friendly output (JSON + text)\n"
                "- Zero runtime dependencies\n\n## Non-goals\n- GUI / TUI mode in v1"
            ),
        },
        {
            "ref": "feature",
            "type": "Feature Scope",
            "title": "Subcommands",
            "x": 320, "y": 0,
            "content": (
                "## Summary\nTop-level command with `init`, `run`, `list`, `delete` subcommands.\n\n"
                "## Functional requirements\n- Config via file + flags + env\n"
                "- Both human and `--json` machine output\n- Exit codes per failure class"
            ),
        },
        {
            "ref": "rules",
            "type": "AI Coding Rules",
            "title": "Conventions",
            "x": 320, "y": 260,
            "content": (
                "## DO\n- Return descriptive errors with exit codes\n- Stable JSON schema on `--json`\n"
                "- Cover every subcommand with an integration test\n\n## DO NOT\n- Print to stderr unless it is an error"
            ),
        },
        {
            "ref": "arch",
            "type": "Technical Architecture",
            "title": "Stack",
            "x": 640, "y": -120,
            "content": (
                "## Components\n- Go 1.22 with Cobra for command tree\n- Viper for config\n"
                "- Single static binary built via goreleaser\n\n## Trade-offs\n- Go for cross-compile + binary size"
            ),
        },
        {
            "ref": "api",
            "type": "API Contracts",
            "title": "Command signatures",
            "x": 960, "y": -80,
            "content": (
                "## Subcommands\n```\nmytool init [--force]\n"
                "mytool run <task> [--json] [--verbose]\n"
                "mytool list [--filter=<glob>]\n"
                "mytool delete <id>\n```\n\n"
                "## Exit codes\n- 0 ok · 1 generic · 2 usage · 3 not found"
            ),
        },
        {
            "ref": "test",
            "type": "Testing Instructions",
            "title": "QA",
            "x": 640, "y": 140,
            "content": (
                "## Unit tests\n- Config precedence (flag > env > file)\n\n"
                "## Integration\n- Snapshot tests on `--json` output for each subcommand\n\n"
                "## E2E\n- `init` → `run` → `list` end-to-end on a fixture project"
            ),
        },
        {
            "ref": "deploy",
            "type": "Deployment Requirements",
            "title": "Distribution",
            "x": 960, "y": 180,
            "content": (
                "## Pipeline\n- goreleaser builds linux/macos/windows binaries on tag\n"
                "- Publishes to GitHub Releases + Homebrew tap\n\n## Channels\n- stable · edge"
            ),
        },
    ],
    "edges": [
        ("overview", "feature", "depends_on"),
        ("rules", "feature", "constrains"),
        ("feature", "arch", "depends_on"),
        ("arch", "api", "implements"),
        ("feature", "test", "produces"),
        ("arch", "deploy", "depends_on"),
    ],
}


API_SERVICE = {
    "label": "API Service",
    "description": "Backend API service with versioned endpoints + DB.",
    "nodes": [
        {
            "ref": "overview",
            "type": "Product Overview",
            "title": "Product Overview",
            "x": 0, "y": 0,
            "content": (
                "## Vision\nA versioned REST API service.\n\n## Goals\n- Stable v1 contract\n"
                "- 100ms p95 read latency\n- Horizontal-scalable stateless workers\n\n"
                "## Non-goals\n- Public marketing site in v1"
            ),
        },
        {
            "ref": "feature",
            "type": "Feature Scope",
            "title": "Endpoint groups",
            "x": 320, "y": -100,
            "content": (
                "## Summary\nAuth, resource CRUD, search, webhook delivery.\n\n"
                "## Functional requirements\n- API-key + JWT auth\n- Cursor pagination\n"
                "- Rate-limiting per key\n\n## Out of scope\n- GraphQL"
            ),
        },
        {
            "ref": "rules",
            "type": "AI Coding Rules",
            "title": "Conventions",
            "x": 320, "y": 140,
            "content": (
                "## DO\n- Pydantic schemas for every request/response\n- Idempotency-Key on writes\n"
                "- Return RFC-7807 problem details on errors\n\n## DO NOT\n- Break v1 contract — add v2 namespace"
            ),
        },
        {
            "ref": "arch",
            "type": "Technical Architecture",
            "title": "Stack",
            "x": 640, "y": -180,
            "content": (
                "## Components\n- FastAPI + uvicorn workers\n- PostgreSQL via SQLAlchemy\n"
                "- Redis for rate-limit counters + queues\n\n## Data flow\nClient → API → DB / Queue"
            ),
        },
        {
            "ref": "db",
            "type": "Database Schema",
            "title": "Entities",
            "x": 960, "y": -240,
            "content": (
                "## Entities\n```\nApiKey { id, ownerId, hash, scopes, createdAt }\n"
                "Resource { id, ownerId, payload, createdAt, updatedAt }\n"
                "WebhookSubscription { id, url, secret, events }\n```"
            ),
        },
        {
            "ref": "api",
            "type": "API Contracts",
            "title": "REST v1",
            "x": 960, "y": 0,
            "content": (
                "## Endpoints\n```\nGET    /v1/resources?cursor=...&limit=...\n"
                "POST   /v1/resources    (Idempotency-Key required)\n"
                "GET    /v1/resources/{id}\n"
                "DELETE /v1/resources/{id}\n"
                "POST   /v1/webhooks\n```\n\n"
                "## Auth\n`Authorization: Bearer <api-key>`\n\n## Errors\nRFC-7807 problem+json"
            ),
        },
        {
            "ref": "test",
            "type": "Testing Instructions",
            "title": "QA",
            "x": 640, "y": 120,
            "content": (
                "## Unit\n- Schema validation edge cases\n\n## Integration\n- Idempotency-Key replay\n"
                "- Rate-limit windowing\n\n## Load\n- k6 baseline: 500 rps, p95 < 100ms"
            ),
        },
        {
            "ref": "deploy",
            "type": "Deployment Requirements",
            "title": "Infra",
            "x": 960, "y": 220,
            "content": (
                "## Environments\n- staging · production\n\n## Pipeline\n- Docker image to GHCR\n"
                "- Helm chart to k8s\n- Migrations run in pre-deploy hook\n\n"
                "## Secrets\n- DATABASE_URL\n- REDIS_URL\n- JWT_SIGNING_KEY"
            ),
        },
    ],
    "edges": [
        ("overview", "feature", "depends_on"),
        ("rules", "feature", "constrains"),
        ("rules", "arch", "constrains"),
        ("feature", "arch", "depends_on"),
        ("arch", "db", "implements"),
        ("arch", "api", "implements"),
        ("feature", "test", "produces"),
        ("arch", "deploy", "depends_on"),
    ],
}


TEMPLATES: dict[str, dict] = {
    "saas_app": SAAS_APP,
    "cli_tool": CLI_TOOL,
    "api_service": API_SERVICE,
}


TEMPLATE_META = [
    {"id": k, "label": v["label"], "description": v["description"]}
    for k, v in TEMPLATES.items()
]
