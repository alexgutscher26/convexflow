# ConvexFlow — Comprehensive TODO & Improvement Roadmap

> Status legend: `[ ]` = todo · `[x]` = done · `[~]` = in-progress · `[!]` = critical / blocking

---

## 🔴 CRITICAL (Security & Stability)

### Authentication & Authorization
- [ ] **[!] Encrypt GitHub PATs at rest** — currently stored in plaintext in MongoDB (`server.py:617`); use Fernet/AES symmetric encryption with a `SECRET_KEY` env var
- [ ] **[!] Add JWT refresh-token flow** — current 30-day access token has no revocation mechanism; add short-lived access tokens + long-lived refresh tokens
- [ ] **[!] Rate-limit auth endpoints** — `/auth/login` and `/auth/register` are open to brute-force attacks; implement `slowapi` or Redis-backed rate limiting
- [ ] **[!] Validate JWT audience/issuer claims** — currently only `sub`, `iat`, `exp` are checked; add `iss` and `aud` claims for defense-in-depth
- [ ] **[!] Add CSRF protection** — SameSite cookie policy or double-submit cookie pattern for state-mutating endpoints
- [ ] **[!] Password strength validation** — only a `min_length=6` check exists; enforce complexity rules (uppercase, digit, special char)
- [ ] **[!] User email verification** — no email confirmation step after registration; users can register with any email they don't own
- [ ] **[!] Secure logout endpoint** — no `/auth/logout`; tokens can't be invalidated before expiry; implement a token blacklist (Redis or DB)

### API & Data Security
- [ ] **[!] Remove plaintext PAT from API response** — `pat_stored: bool` is returned, but the raw PAT value may leak in logs; audit all logging statements
- [ ] **[!] Parameterize all MongoDB queries** — audit for NoSQL injection surface; avoid any `eval` or dynamic `$where` clauses
- [ ] **[!] Add input sanitization for node content** — large or malicious Markdown content could cause DoS via rendering or AI context overflow
- [ ] **[!] Enforce project-level authorization on all node/edge endpoints** — verify `assert_project_owner` is called consistently on every mutating endpoint
- [ ] **[!] CORS hardening** — replace wildcard `allow_origins=["*"]` with an explicit allowlist from env var
- [ ] **[!] Secrets never in codebase** — run `git log --all --full-history -- '*.env'` audit; add `gitleaks` to CI

---

## 🟠 HIGH PRIORITY

### Backend — Architecture & Reliability

- [ ] **Add database indexes** — create compound indexes on `{project_id, type}` for nodes, `{project_id}` for edges and snapshots; MongoDB will full-scan without them
- [ ] **Pagination for all list endpoints** — `list_nodes` returns up to 2000 items, `list_edges` up to 5000 with no cursor/offset; implement cursor-based pagination
- [ ] **Async background tasks for AI calls** — AI expand/generate-prompt are synchronous; move to `BackgroundTasks` or a Celery/ARQ worker queue to prevent request timeouts
- [ ] **Structured logging with correlation IDs** — replace basic `logging.basicConfig` with `structlog` or JSON logging; inject `request_id` per request via middleware
- [ ] **Health & readiness endpoints** — add `/health` (liveness) and `/ready` (DB connectivity check) for container orchestration
- [ ] **Global error handler** — add FastAPI exception handlers for unhandled exceptions, returning a consistent error envelope `{error, code, request_id}`
- [ ] **MongoDB connection pooling configuration** — `AsyncIOMotorClient` defaults are not tuned; set `maxPoolSize`, `minPoolSize`, `serverSelectionTimeoutMS`
- [ ] **Graceful shutdown** — handle `SIGTERM` to drain in-flight requests before shutting down the Motor client
- [ ] **Environment variable validation on startup** — fail fast with a clear message if required env vars (`MONGO_URL`, `JWT_SECRET`) are missing
- [ ] **Split `server.py` into routers** — the single 1517-line file is unmaintainable; split into `routers/auth.py`, `routers/projects.py`, `routers/nodes.py`, `routers/edges.py`, `routers/ai.py`, `routers/github.py`
- [ ] **Add `alembic`-equivalent schema migration** — add a `migrations/` pattern for Mongo using `mongomigrations` or a custom version-collection approach
- [ ] **Snapshot pruning policy** — snapshots accumulate forever; add TTL index or a configurable retention limit (e.g., max 50 per project)
- [ ] **Optimistic locking on node updates** — concurrent edits to the same node will silently overwrite; add a `version` field with a `$inc` + pre-check pattern
- [ ] **Soft-delete for projects/nodes** — hard deletes make recovery impossible; add `deleted_at` field and a restore endpoint

### Frontend — Core UX

- [ ] **Global API error boundary** — unhandled Axios errors currently may surface as blank screens; add a React Error Boundary + global `axios.interceptors.response`
- [ ] **Persist auth token securely** — audit whether `localStorage` is used (XSS risk); prefer `httpOnly` cookies or `sessionStorage` with a refresh flow
- [ ] **Optimistic UI updates** — all mutations wait for API round-trip before reflecting; add Zustand-optimistic updates with rollback on error
- [ ] **Loading skeletons** — replace all spinner-only states with skeleton screens for project cards, canvas, and inspector panels
- [ ] **Keyboard navigation on canvas** — ReactFlow nodes should be selectable/movable via arrow keys for accessibility
- [ ] **Undo/redo stack** — node create/move/delete should be undoable with Ctrl+Z / Ctrl+Y; integrate with canvas state management
- [ ] **Canvas minimap** — large graphs are hard to navigate; enable ReactFlow's built-in `<MiniMap />` component
- [ ] **Multi-select and bulk actions** — allow shift-click or drag-select to select multiple nodes for bulk delete, copy, or group
- [ ] **Node search / spotlight** — add a Cmd+K command palette that searches nodes by title or content across the current project
- [ ] **Inline node editing** — double-clicking a node on the canvas should open an inline Markdown editor without navigating to Inspector
- [ ] **Auto-layout button** — add a "Auto-arrange" action using a DAG layout algorithm (ELK or Dagre, already supported by ReactFlow)
- [ ] **Node color coding by type** — each node type should have a distinct color/icon for quick visual scanning
- [ ] **Edge labels and types** — visually distinguish `depends_on`, `constrains`, `implements`, etc. with different edge styles/colors
- [ ] **Canvas zoom-to-fit on load** — after loading a project, call `fitView()` so all nodes are visible immediately

---

## 🟡 MEDIUM PRIORITY

### New Features — Core Product

- [ ] **Real-time collaboration (WebSockets)** — multiple users editing the same canvas should see each other's cursors and changes live; evaluate `Socket.io` or Convex's real-time layer
- [ ] **Team & workspace support** — projects are currently `owner_id` only; add teams with roles (Owner, Editor, Viewer) and project sharing
- [ ] **Comment / annotation system** — allow threaded comments pinned to specific nodes; surface in a sidebar feed
- [ ] **Node version history** — store diffs on every node update in a `node_history` collection so users can view/restore past content
- [ ] **Project duplication** — "Duplicate Project" button that deep-copies all nodes, edges, and snapshots with new IDs
- [ ] **Project archiving** — ability to archive completed projects without deleting them; archived projects hidden from main dashboard by default
- [ ] **Shareable read-only project links** — generate a signed URL that allows anyone to view (but not edit) a project graph
- [ ] **Export to additional formats** — add `PDF`, `HTML`, `Notion` integration, and `Confluence` page export alongside the existing `markdown/json/agent_pack/cursorrules`
- [ ] **Import graph from JSON/Markdown** — reverse of export; allow users to seed a project from an exported JSON or structured markdown
- [ ] **Webhook notifications** — fire configurable webhooks (Slack, Discord, custom URL) on project events (snapshot created, AI prompt generated, etc.)
- [ ] **Node templates / snippets** — allow users to save frequently used node content as reusable snippets
- [ ] **Project tags and filtering** — add tagging to projects with a filter/search on the Dashboard
- [ ] **AI chat panel** — a side-drawer chatbot that has full graph context and can answer questions without generating a new node
- [ ] **Graph diff view** — compare two snapshots side-by-side showing added/removed/changed nodes and edges

### AI & LLM Enhancements

- [ ] **Streaming AI responses** — instead of waiting for full AI response, stream tokens via SSE to the frontend for better perceived performance
- [ ] **AI model selector** — let users choose between Claude, GPT-4o, Gemini, or a local model per-generation without changing env vars
- [ ] **Custom system prompt per project** — allow users to override the AI co-pilot persona/instructions for each project
- [ ] **AI usage dashboard** — show per-user token usage, estimated cost, and remaining balance for the Emergent LLM key
- [ ] **Contextual node suggestions** — after creating a node, AI proactively suggests which other node types should be linked to it
- [ ] **Generate multiple alternatives** — AI expand should offer 2–3 alternative versions for the user to choose from
- [ ] **AI-assisted edge creation** — auto-suggest relationships between nodes based on semantic analysis of their content
- [ ] **Hallucination guard** — before returning AI content, run a quick validation pass checking that all file paths and technology names cited actually exist in the project
- [ ] **Prompt caching for identical contexts** — cache AI responses for the same project graph hash to avoid duplicate API calls
- [ ] **Support OpenAI-compatible local LLM providers** — extend `LocalLlmChat` to support authentication headers, model listing, and connection-testing endpoint

### GitHub Integration Improvements

- [ ] **GitHub OAuth app integration** — replace PAT-based auth with GitHub OAuth flow for a frictionless and more secure experience
- [ ] **Automatic re-scan on push** — set up a GitHub webhook receiver to trigger `scan_repo` automatically on every push to the tracked branch
- [ ] **File content preview** — clicking a file reference in a node should show the file's content fetched from GitHub in a side panel
- [ ] **Pull request context node** — fetch open PRs and their descriptions as a new node type for PR review planning
- [ ] **GitHub Issues import** — fetch GitHub issues (open/closed) and allow mapping them to requirement nodes
- [ ] **Branch comparison** — allow comparing the file tree between two branches in the repository settings
- [ ] **Commit history timeline** — show recent commits with author, message, and changed files as a canvas-overlay timeline

### Dashboard & Discovery

- [ ] **Project search** — full-text search across project names, descriptions, and node content
- [ ] **Recent nodes widget** — Dashboard sidebar showing the most recently modified nodes across all projects
- [ ] **Activity feed** — chronological log of all actions (node created, AI generated, snapshot, export) per project
- [ ] **Project health score** — a computed score based on completeness (e.g., has PRD, has acceptance criteria, has test plan, etc.)
- [ ] **Quick-create from dashboard** — floating "+" button on dashboard that opens a minimal creation form (name + template picker) without leaving the page
- [ ] **Star / favorite projects** — pin important projects to the top of the dashboard list

---

## 🟢 LOW PRIORITY / POLISH

### Frontend UX Polish

- [ ] **Dark mode polish** — audit all components for hard-coded colors not respecting the Tailwind dark theme; add a theme toggle in the header
- [ ] **Responsive / mobile layout** — the canvas is desktop-only; add a read-only mobile view of node content with a list-based fallback
- [ ] **Onboarding tour** — add a first-run walkthrough using a library like `react-joyride` to guide new users through creating their first project
- [ ] **Empty states** — design and implement rich empty states for: no projects, empty canvas, no snapshots, no search results
- [ ] **Tooltips for all icon buttons** — all icon-only controls should have `title` or `Tooltip` wrappers for discoverability
- [ ] **Drag-and-drop node reordering in sidebar** — allow reordering the node list in the Sidebar by drag and drop
- [ ] **Node content word count / character limit indicator** — show a live count in the Inspector editor footer
- [ ] **Copy node ID button** — useful for debugging and file-reference linking
- [ ] **Breadcrumb navigation** — Canvas → Dashboard navigation should display the project name clearly in the header
- [ ] **Animated transitions** — add subtle route transitions (fade/slide) between Dashboard and Canvas pages
- [ ] **Confetti on first AI generation** — micro-delight animation on the very first time a user generates an AI prompt

### Developer Experience

- [ ] **Docker Compose setup** — create a `docker-compose.yml` with services for `backend`, `frontend`, and `mongo` for one-command local dev
- [ ] **Makefile / task runner** — add a `Makefile` with `make dev`, `make test`, `make lint`, `make build` commands
- [ ] **Pre-commit hooks** — configure `pre-commit` with `black`, `isort`, `flake8`, `eslint`, and `prettier`
- [ ] **VS Code workspace settings** — add `.vscode/settings.json` and `extensions.json` recommendations for the team
- [ ] **TypeScript migration (frontend)** — migrate `*.jsx` files to `*.tsx` progressively; enables better type safety for API responses
- [ ] **API client code generation** — generate a typed frontend API client from the FastAPI OpenAPI spec using `openapi-typescript`
- [ ] **Environment variable documentation** — create a `.env.example` for both backend and frontend with all variables documented
- [ ] **Backend hot-reload improvement** — add `--reload-dir` to uvicorn to only watch `backend/` instead of the whole repo

### Testing

- [ ] **Backend unit tests** — write `pytest` unit tests for `validation.py`, `wizard.py`, and `templates.py` logic (currently zero coverage)
- [ ] **Backend integration tests** — use `httpx.AsyncClient` with a test MongoDB instance (or `mongomock`) to test all API routes
- [ ] **Frontend component tests** — add `@testing-library/react` tests for `CustomNode`, `Inspector`, `Sidebar`, and `Console` components
- [ ] **E2E tests with Playwright** — critical user journeys: register → create project → add nodes → run AI → export
- [ ] **Snapshot regression tests** — visual snapshot tests for key UI states using Playwright screenshots
- [ ] **CI pipeline** — add GitHub Actions workflow running lint, unit tests, and integration tests on every PR
- [ ] **Coverage reporting** — integrate `pytest-cov` (backend) and `jest --coverage` (frontend) with a minimum threshold gate
- [ ] **Load testing** — use `locust` or `k6` to characterize performance under concurrent AI calls and canvas loads
- [ ] **Contract testing** — validate that the frontend API calls match the FastAPI OpenAPI schema on every build

### Performance

- [ ] **Frontend bundle splitting** — audit `craco build` output; split `reactflow` and `recharts` into separate async chunks
- [ ] **Virtual rendering for large graphs** — ReactFlow handles ~500 nodes before degrading; implement node culling for graphs with 500+ nodes
- [ ] **Memoize React components** — wrap `CustomNode`, `Inspector`, and `Sidebar` with `React.memo`; use `useCallback`/`useMemo` for handlers
- [ ] **Debounce position updates** — node drag emits position updates; debounce the `PUT /nodes/{id}` API call to reduce write amplification
- [ ] **MongoDB read replicas** — configure a read-preference of `secondaryPreferred` for list queries to reduce primary load
- [ ] **CDN for static assets** — serve the React build from a CDN (Cloudfront, Vercel Edge) rather than the FastAPI server
- [ ] **Gzip / Brotli compression** — add `GZipMiddleware` to FastAPI for all JSON responses
- [ ] **Image optimization** — any logo/avatar images in the UI should be WebP with proper `srcset` attributes

### Observability & DevOps

- [ ] **OpenTelemetry instrumentation** — add `opentelemetry-sdk` to the backend and instrument FastAPI routes, MongoDB calls, and LLM calls
- [ ] **Sentry error tracking** — integrate Sentry on both frontend (React) and backend (FastAPI) for production error capture
- [ ] **Uptime monitoring** — configure a health check monitor (Better Uptime / Checkly) against the `/health` endpoint
- [ ] **Automated DB backups** — add a cron job or Atlas scheduled backup to snapshot MongoDB daily with 7-day retention
- [ ] **Deployment guide** — document a production deployment guide covering: Fly.io / Railway / Render for the backend + Vercel for the frontend
- [ ] **Environment separation** — document and enforce strict `dev` / `staging` / `prod` environment separation with different DB names and JWT secrets
- [ ] **Dependency update automation** — configure `Renovate` or `Dependabot` to auto-open PRs for outdated packages

### Documentation

- [ ] **API reference docs** — expose the FastAPI Swagger UI at `/docs` in development only; generate a static OpenAPI doc for production
- [ ] **CONTRIBUTING.md** — write contribution guidelines, PR process, coding standards, and branch naming conventions
- [ ] **ARCHITECTURE.md** — document the overall system architecture: data flow, component responsibilities, and technology choices with rationale
- [ ] **Node type reference** — write user-facing documentation explaining every node type and when to use it
- [ ] **Wizard flow docs** — document the wizard options (`project_kind`, `stack`, `features`, `deployment`) and what graph they produce
- [ ] **Local LLM setup guide** — step-by-step guide for configuring Ollama or LM Studio as the local LLM provider
- [ ] **Video walkthrough** — record a 3–5 minute demo video of the full workflow: wizard → canvas → AI expand → export

---

## 💡 FUTURE / BACKLOG (Longer-Term Vision)

- [ ] **Plugin system** — allow third-party integrations (Jira, Linear, Notion) to push/pull node data via a registered webhook interface
- [ ] **AI agent mode** — given a project graph, have an AI agent autonomously scaffold a working project skeleton (files, directories, boilerplate)
- [ ] **Voice input for nodes** — use Web Speech API or Whisper to dictate node content
- [ ] **Figma / design integration** — attach Figma frames or Loom recordings as node attachments in UI Requirements nodes
- [ ] **Graph analytics** — visualize graph metrics: node centrality, most connected requirements, longest dependency chains
- [ ] **Multi-project graph view** — a "portfolio" view showing all projects as a high-level connected graph
- [ ] **Self-hosted LLM routing** — smart routing between local and cloud models based on token length, privacy level, and cost
- [ ] **Mobile app (React Native)** — read-only viewer app for reviewing project graphs on mobile
- [ ] **Offline mode** — cache the current project graph in IndexedDB and sync changes when connection is restored
- [ ] **Generative graph seeding from a URL** — paste a GitHub repo URL or a product brief URL and auto-generate the initial graph
- [ ] **MCP server integration** — expose ConvexFlow project data via the Model Context Protocol so agents like Claude can consume it directly
- [ ] **White-label / multi-tenant SaaS** — support multiple isolated organizations with custom domains and branding
- [ ] **AI PR review assistant** — given the project graph and a GitHub PR diff, generate a structured review checklist
- [ ] **Marketplace for templates** — community-contributed project templates that can be imported with one click

---

## 📋 QUICK WINS (< 2 hours each)

- [ ] Move `import base64` out of the loop in `scan_repo` (it's re-imported on every iteration)
- [ ] Add `Content-Security-Policy` and `X-Content-Type-Options` response headers via FastAPI middleware
- [ ] Add `.editorconfig` file to enforce consistent indentation across the repo
- [ ] Pin all `requirements.txt` versions to exact versions for reproducible builds
- [ ] Add a `CHANGELOG.md` and start tracking changes using Keep a Changelog format
- [ ] Add `"engines"` field to `frontend/package.json` to enforce Node.js version
- [ ] Add `robots.txt` and `sitemap.xml` for the landing page
- [ ] Add `<meta name="description">` and Open Graph tags to `public/index.html`
- [ ] Remove unused `pandas` and `numpy` from `requirements.txt` (not used anywhere in `server.py`)
- [ ] Rename the app title from `"CortexFlow API"` in `server.py:48` to `"ConvexFlow API"` to match the project name
- [ ] Add `favicon.ico` for the web app (currently missing)
- [ ] Display the current app version in the UI footer (read from `package.json`)
- [ ] Add `SECURITY.md` file with responsible disclosure policy

---

*Last updated: 2026-05-16 | Generated by Antigravity based on codebase analysis*
