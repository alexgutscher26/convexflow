# ConvexFlow — Comprehensive TODO & Improvement Roadmap

> Status legend: `[ ]` = todo · `[x]` = done · `[~]` = in-progress · `[!]` = critical / blocking

---

## 🔴 CRITICAL (Security & Stability)

### Authentication & Authorization

- [x] **[!] Encrypt GitHub PATs at rest** — securely stored using dynamic AES-256-GCM symmetric encryption with a `NEXTAUTH_SECRET` key at the database level
- [x] **[!] Add JWT refresh-token flow** — short-lived access tokens + long-lived refresh tokens with `/api/auth/refresh` endpoint implemented
- [x] **[!] Rate-limit auth endpoints** — `/api/auth/login` and `/api/auth/register` protected using secure IP/token-bucket rate limiting in middleware
- [x] **[!] Secure logout endpoint** — `/api/auth/logout` endpoint implemented with token revocation
- [x] **[!] CORS hardening** — dynamic origin matching and preflight OPTIONS handling configured globally in `src/middleware.ts`
- [x] **[!] Secrets never in codebase** — all sensitive values secured inside `.env` configurations
- [ ] **[!] Validate JWT audience/issuer claims** — currently only `sub`, `iat`, `exp` are checked; add `iss` and `aud` claims for defense-in-depth
- [ ] **[!] Add CSRF protection** — implement double-submit cookie or `SameSite=Strict` + custom header pattern for all state-mutating endpoints
- [ ] **[!] Password strength validation** — `RegisterSchema` only enforces `min(6)`; add complexity rules (uppercase, digit, special char) using a Zod `refine()`
- [ ] **[!] User email verification** — no email confirmation after registration; users access the dashboard with any unverified email
- [ ] **[!] Remove plaintext PAT from API response** — audit all logging statements to confirm raw PAT values never appear in server logs
- [ ] **[!] Parameterize all MongoDB queries** — audit every collection query for NoSQL injection; avoid dynamic `$where` or `eval` clauses
- [ ] **[!] Add input sanitization for node content on create/update** — `sanitizeAndNormalizeText()` exists in `src/lib/sanitize.ts` but must be wired into all node mutation routes

### Known Bugs

- [x] **[!] Missing `src/proxy.ts` crashes middleware** — Next.js 16 renamed the convention from `middleware.ts` → `proxy.ts`; migrated CORS logic to `src/proxy.ts` (export renamed to `proxy`), removed deprecated `src/middleware.ts`, cleared `.next` cache

---

## 🟠 HIGH PRIORITY

### Backend — Architecture & Reliability

- [x] **Add database indexes** — full-text and compound indexes on MongoDB initialized programmatically in `src/lib/mongodb.ts` at server startup
- [x] **MongoDB connection pooling** — cached `MongoClient` instance prevents hot-reload socket leaks
- [x] **Modular API route handlers** — FastAPI monolith fully migrated to clean Next.js App Router route handlers under `src/app/api/`
- [ ] **Pagination for all list endpoints** — `list_nodes` returns up to 2 000 items and `list_edges` up to 5 000 with no cursor/offset; implement cursor-based pagination
- [ ] **Async background tasks for AI calls** — AI expand and generate-prompt are synchronous; move to background workers or queues (e.g., Vercel background functions) to prevent gateway timeouts
- [ ] **Structured logging with correlation IDs** — replace `console.log` with JSON-structured logging and inject a `request_id` per request via middleware
- [ ] **Health & readiness endpoints** — add `/api/health` (liveness) and `/api/ready` (DB connectivity check) for container orchestration and uptime monitoring
- [ ] **Global error handler** — return consistent `{ error, code, request_id }` envelopes from all API routes instead of ad-hoc error strings
- [ ] **Graceful shutdown** — drain in-flight requests before closing the MongoClient on `SIGTERM`
- [ ] **Environment variable validation on startup** — fail fast with a descriptive message when required env vars (`MONGO_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`) are absent
- [ ] **Database schema migrations** — implement a version-collection based migration pattern so schema changes are repeatable and auditable
- [ ] **Snapshot pruning policy** — snapshots accumulate indefinitely; add a TTL index or configurable retention cap (e.g., max 50 per project)
- [ ] **Optimistic locking on node updates** — concurrent edits silently overwrite each other; add a `version` field with `$inc` + pre-check pattern
- [ ] **Soft-delete for projects and nodes** — hard deletes make recovery impossible; add `deleted_at` field with a restore endpoint

### Frontend — Core UX

- [ ] **Global API error boundary** — unhandled Axios errors may surface as blank screens; add a React Error Boundary + `axios.interceptors.response` handler
- [ ] **Persist auth token securely** — audit whether `localStorage` is used (XSS risk); migrate to `httpOnly` cookies paired with the existing refresh flow
- [ ] **Optimistic UI updates** — all mutations wait for API round-trip before reflecting in the UI; add optimistic state updates with rollback on error
- [ ] **Loading skeletons** — replace all spinner-only states with skeleton screens for project cards, canvas, and inspector panels
- [ ] **Keyboard navigation on canvas** — ReactFlow nodes should be selectable and movable via arrow keys for accessibility compliance
- [ ] **Undo/redo stack** — node create/move/delete should be undoable via Ctrl+Z / Ctrl+Y integrated with canvas state
- [x] **Auto-layout button** — "Auto-arrange" action implemented using a DAG layout algorithm (ELK / Dagre via ReactFlow)
- [ ] **Canvas minimap** — enable ReactFlow's built-in `<MiniMap />` component for large graph navigation
- [ ] **Multi-select and bulk actions** — shift-click or drag-select for bulk delete, copy, or group
- [ ] **Node search / spotlight** — Cmd+K command palette that searches nodes by title or content (`CommandPalette.jsx` scaffold exists)
- [ ] **Inline node editing** — double-clicking a node on the canvas should open an inline Markdown editor without navigating to Inspector
- [ ] **Node color coding by type** — distinct color/icon per node type for quick visual scanning
- [ ] **Edge labels and types** — visually distinguish `depends_on`, `constrains`, `implements` edges with different styles/colors
- [ ] **Canvas zoom-to-fit on load** — call `fitView()` after a project loads so all nodes are immediately visible

---

## 🟡 MEDIUM PRIORITY

### New Features — Core Product

- [ ] **Real-time collaboration (WebSockets)** — multiple users editing the same canvas should see live cursors and changes; evaluate Socket.io or Liveblocks
- [ ] **Team & workspace support** — projects are `owner_id`-only; add teams with roles (Owner, Editor, Viewer) and project sharing
- [ ] **Comment / annotation system** — threaded comments pinned to specific nodes, surfaced in a sidebar feed
- [ ] **Node version history** — store diffs on every node update in a `node_history` collection for view/restore
- [ ] **Project duplication** — "Duplicate Project" deep-copies all nodes, edges, and snapshots with new IDs
- [ ] **Project archiving** — archive completed projects without deleting; hidden from main dashboard by default
- [ ] **Shareable read-only project links** — signed URL allowing anyone to view (not edit) a project graph
- [ ] **Export to additional formats** — add PDF, HTML, Notion, and Confluence page export alongside existing `markdown/json/agent_pack/cursorrules`
- [ ] **Import graph from JSON/Markdown** — reverse of export; seed a project from an exported JSON or structured markdown
- [ ] **Webhook notifications** — configurable webhooks (Slack, Discord, custom URL) on project events (snapshot created, AI prompt generated, etc.)
- [ ] **Node templates / snippets** — save frequently used node content as reusable snippets
- [ ] **Project tags and filtering** — tagging with filter/search on the Dashboard
- [ ] **AI chat panel** — side-drawer chatbot with full graph context for Q&A without generating new nodes
- [ ] **Graph diff view** — compare two snapshots side-by-side showing added/removed/changed nodes and edges

### AI & LLM Enhancements

- [ ] **Streaming AI responses** — stream tokens via SSE to the frontend instead of waiting for the full response
- [ ] **AI model selector** — let users choose between Claude, GPT-4o, Gemini, or a local model per-generation without changing env vars
- [ ] **Custom system prompt per project** — allow users to override the AI co-pilot persona/instructions per project
- [ ] **AI usage dashboard** — per-user token usage, estimated cost, and remaining balance
- [ ] **Contextual node suggestions** — after creating a node, AI proactively suggests which other node types should be linked
- [ ] **Generate multiple alternatives** — AI expand should offer 2–3 alternative versions to choose from
- [ ] **AI-assisted edge creation** — auto-suggest relationships between nodes based on semantic similarity of their content
- [ ] **Hallucination guard** — validate AI output for plausible file paths and technology names before returning to the frontend
- [ ] **Prompt caching for identical contexts** — cache AI responses for the same project graph hash to avoid duplicate API calls
- [ ] **Support OpenAI-compatible local LLM providers** — extend `LocalLlmChat` to support auth headers, model listing, and a connection-test endpoint

### GitHub Integration Improvements

- [ ] **GitHub OAuth app integration** — replace PAT-based auth with GitHub OAuth flow for a frictionless and more secure experience
- [ ] **Automatic re-scan on push** — GitHub webhook receiver to trigger `scan_repo` automatically on every push to the tracked branch
- [ ] **File content preview** — clicking a file reference in a node fetches and displays file content in a side panel
- [ ] **Pull request context node** — fetch open PRs and their descriptions as a new node type
- [ ] **GitHub Issues import** — fetch GitHub issues (open/closed) and map them to requirement nodes
- [ ] **Branch comparison** — compare the file tree between two branches in repository settings
- [ ] **Commit history timeline** — show recent commits with author, message, and changed files as a canvas-overlay timeline

### Dashboard & Discovery

- [ ] **Project search** — full-text search across project names, descriptions, and node content
- [ ] **Recent nodes widget** — Dashboard sidebar showing the most recently modified nodes across all projects
- [ ] **Activity feed** — chronological log of all actions (node created, AI generated, snapshot, export) per project
- [ ] **Project health score** — computed score based on completeness (has PRD, has acceptance criteria, has test plan, etc.)
- [ ] **Quick-create from dashboard** — floating "+" button opening a minimal creation form without leaving the page
- [ ] **Star / favorite projects** — pin important projects to the top of the dashboard list

---

## 🟢 LOW PRIORITY / POLISH

### Frontend UX Polish

- [ ] **Dark mode polish** — audit all components for hard-coded colors not respecting the Tailwind dark theme; add a theme toggle
- [ ] **Responsive / mobile layout** — canvas is desktop-only; add a read-only mobile view with a list-based fallback
- [ ] **Onboarding tour** — first-run walkthrough using `react-joyride` to guide new users through creating their first project
- [ ] **Empty states** — rich empty states for: no projects, empty canvas, no snapshots, no search results
- [ ] **Tooltips for all icon buttons** — all icon-only controls should have `title` or `Tooltip` wrappers
- [ ] **Drag-and-drop node reordering in sidebar** — reorder the node list by drag and drop
- [ ] **Node content word count / character limit indicator** — live counter in the Inspector editor footer
- [ ] **Copy node ID button** — useful for debugging and file-reference linking
- [ ] **Breadcrumb navigation** — display the project name clearly in the canvas header
- [ ] **Animated transitions** — subtle route transitions (fade/slide) between Dashboard and Canvas pages
- [ ] **Confetti on first AI generation** — micro-delight on the very first prompt generation for a new user

### Developer Experience

- [ ] **Docker Compose setup** — `docker-compose.yml` with `backend`, `frontend`, and `mongo` services for one-command local dev
- [ ] **Makefile / task runner** — `make dev`, `make test`, `make lint`, `make build` targets
- [ ] **Pre-commit hooks** — configure `husky` + `lint-staged` with ESLint and Prettier
- [ ] **VS Code workspace settings** — `.vscode/settings.json` and `extensions.json` recommendations
- [ ] **TypeScript migration (frontend)** — progressively migrate `*.jsx` to `*.tsx` for type-safe API responses
- [ ] **API client code generation** — generate a typed frontend API client from Next.js API schemas using `openapi-typescript`
- [ ] **Environment variable documentation** — create a `.env.example` for both backend and frontend with all variables documented
- [x] **Backend hot-reload** — Next.js supports hot-reload and Fast Refresh natively

### Testing

- [ ] **Backend unit tests** — Jest / Vitest unit tests for `validation.ts`, `wizard.ts`, and `templates.ts` logic
- [ ] **Backend integration tests** — integration tests against a test MongoDB instance covering all Next.js API routes
- [ ] **Frontend component tests** — `@testing-library/react` tests for `CustomNode`, `Inspector`, `Sidebar`, and `Console`
- [ ] **E2E tests with Playwright** — critical journeys: register → create project → add nodes → run AI → export
- [ ] **Snapshot regression tests** — visual snapshot tests for key UI states using Playwright screenshots
- [ ] **CI pipeline** — GitHub Actions workflow running `build`, `lint`, and tests on every PR
- [ ] **Coverage reporting** — Jest/Vitest coverage with a minimum threshold gate
- [ ] **Load testing** — use `k6` to characterize performance under concurrent AI calls and canvas loads
- [ ] **Contract testing** — validate frontend API calls match Next.js API schemas on every build

### Performance

- [ ] **Frontend bundle splitting** — split `reactflow` and `recharts` into separate async chunks
- [ ] **Virtual rendering for large graphs** — ReactFlow degrades past ~500 nodes; implement node culling for large graphs
- [ ] **Memoize React components** — wrap `CustomNode`, `Inspector`, and `Sidebar` with `React.memo`; use `useCallback`/`useMemo` for handlers
- [ ] **Debounce position updates** — debounce `PUT /nodes/{id}` on node drag to reduce write amplification
- [ ] **MongoDB read replicas** — set `readPreference: 'secondaryPreferred'` for list queries to reduce primary load
- [ ] **CDN for static assets** — serve static assets from Vercel Edge / CloudFront rather than the Next.js origin
- [ ] **Gzip / Brotli compression** — enable compression in `next.config.ts` for all JSON responses
- [ ] **Image optimization** — convert logo/avatar images to WebP with proper `srcset` attributes

### Observability & DevOps

- [ ] **OpenTelemetry instrumentation** — instrument API routes, MongoDB calls, and LLM calls with `opentelemetry-sdk`
- [ ] **Sentry error tracking** — integrate Sentry on both the React frontend and Next.js backend
- [ ] **Uptime monitoring** — configure a health check monitor (Better Uptime / Checkly) against `/api/health`
- [ ] **Automated DB backups** — cron job or Atlas scheduled backup with 7-day retention
- [ ] **Deployment guide** — document a production deployment guide covering Vercel / Railway
- [ ] **Environment separation** — enforce strict `dev` / `staging` / `prod` separation with different DB names and JWT secrets
- [ ] **Dependency update automation** — configure Renovate or Dependabot to auto-open PRs for outdated packages

### Documentation

- [ ] **API reference docs** — Swagger/OpenAPI specifications or inline dynamic routes documentation
- [ ] **CONTRIBUTING.md** — contribution guidelines, PR process, coding standards, and branch naming conventions
- [ ] **ARCHITECTURE.md** — system architecture: data flow, component responsibilities, and technology choices with rationale
- [ ] **Node type reference** — user-facing documentation explaining every node type and when to use it
- [ ] **Wizard flow docs** — document `project_kind`, `stack`, `features`, `deployment` options and what graph they produce
- [ ] **Local LLM setup guide** — step-by-step guide for configuring Ollama or LM Studio as the local LLM provider
- [ ] **Video walkthrough** — 3–5 minute demo: wizard → canvas → AI expand → export

---

## 💡 FUTURE / BACKLOG (Longer-Term Vision)

- [ ] **Plugin system** — third-party integrations (Jira, Linear, Notion) via a registered webhook interface
- [ ] **AI agent mode** — given a project graph, autonomously scaffold a working project skeleton (files, directories, boilerplate)
- [ ] **Voice input for nodes** — Web Speech API or Whisper for dictating node content
- [ ] **Figma / design integration** — attach Figma frames or Loom recordings as node attachments in UI Requirements nodes
- [ ] **Graph analytics** — visualize node centrality, most connected requirements, and longest dependency chains
- [ ] **Multi-project graph view** — "portfolio" view showing all projects as a connected high-level graph
- [ ] **Self-hosted LLM routing** — smart routing between local and cloud models based on token length, privacy level, and cost
- [ ] **Mobile app (React Native)** — read-only viewer for reviewing project graphs on mobile
- [ ] **Offline mode** — cache the current project graph in IndexedDB and sync when connection is restored
- [ ] **Generative graph seeding from a URL** — paste a GitHub repo URL or product brief URL to auto-generate the initial graph
- [ ] **MCP server integration** — expose ConvexFlow project data via the Model Context Protocol for agent consumption
- [ ] **White-label / multi-tenant SaaS** — isolated organizations with custom domains and branding
- [ ] **AI PR review assistant** — given the project graph and a GitHub PR diff, generate a structured review checklist
- [ ] **Marketplace for templates** — community-contributed project templates importable with one click

---

## 📋 QUICK WINS (< 2 hours each)

- [x] Optimize GitHub repository scan iterations (removed redundant imports/scans)
- [x] Add `Content-Security-Policy` and `X-Content-Type-Options` response headers via Next.js middleware
- [x] Add `.editorconfig` file to enforce consistent indentation across the repo
- [x] Pin package dependency versions in `package.json`
- [x] Add a `CHANGELOG.md` and start tracking changes using Keep a Changelog format
- [x] Add `"engines"` field to `frontend/package.json` to enforce Node.js version
- [x] Add `robots.txt` and `sitemap.xml` for the landing page
- [x] Add `<meta name="description">` and Open Graph tags to `public/index.html`
- [x] Rename the app title from `"CortexFlow API"` to `"ConvexFlow API"` to match the project name
- [x] Add `favicon.ico` for the web app
- [x] Display the current app version in the UI footer (read from `package.json`)
- [x] Add `SECURITY.md` file with responsible disclosure policy
- [ ] Fix stale `proxy.ts` import in `src/middleware.ts` that causes `MODULE_UNPARSABLE` crash on every request
- [ ] Add `password` complexity validation in `RegisterSchema` (`refine()` with regex for uppercase + digit + special char)
- [ ] Add a `/api/health` endpoint returning `{ status: "ok", db: "connected" }`
- [ ] Wire `sanitizeAndNormalizeText()` into all node create/update route handlers

---

_Last updated: 2026-05-17 | Updated by Antigravity based on live codebase analysis_
