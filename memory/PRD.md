# CortexFlow — PRD & Implementation Log

## Original problem statement
Build CortexFlow MVP — an AI-native visual PRD and engineering orchestration platform. Developers compose a project intelligence graph on an infinite canvas with typed nodes, sync GitHub repos for context, and generate structured AI prompts + exports (Markdown / JSON / Agent pack).

After v1 ship, user uploaded the **Archon PRD** (a near-identical product spec). Gaps were identified and shipped in v2.

## User personas
- AI-first indie hackers building solo with Cursor / Claude Code
- Startup CTOs coordinating small teams + AI agents
- Agent orchestrators running autonomous coding agents (Devin, SWE-agent)
- Staff engineers / tech PMs writing AI-consumable specs

## Tech stack (chosen)
- **Frontend**: React 19 + React Flow v11 + Tailwind + Phosphor icons + Chivo + JetBrains Mono fonts
- **Backend**: FastAPI + Motor (MongoDB) + JWT (bcrypt) + emergentintegrations (Claude Sonnet 4.5)
- **AI**: Claude Sonnet 4.5 via Emergent Universal Key
- **GitHub**: PAT-based REST API (no OAuth app needed)

## Core requirements (static)
1. Visual node-based canvas with 14 typed node categories
2. Typed edge relationships (5 types: depends_on, constrains, implements, references, produces)
3. GitHub PAT-based repo sync with lightweight metadata extraction
4. Claude Sonnet 4.5–powered AI prompt generation engine
5. Structured PRD export (Markdown / JSON / Agent pack)
6. Persistent context memory via graph state

## What's been implemented

### v1 (Feb 2026, day 1 — initial MVP)
- JWT email/password auth (register, login, me)
- Projects CRUD
- Nodes CRUD with 12 typed categories, color-coded headers
- Edges CRUD
- GitHub PAT-based repo connect + framework detection scan
- Claude Sonnet 4.5 AI expand endpoint (6 instruction types)
- AI prompt generation engine (6 templates)
- Markdown / JSON / Agent pack export
- Landing page with IDE-inspired "Control Room" aesthetic (Chivo + JetBrains Mono)
- Auth pages (login / register)
- Dashboard (project list, create modal, delete)
- Canvas page: React Flow + sidebar (node library + repo) + inspector + bottom console + command palette (⌘K)
- Auto-save with debounced merge (after fix)
- Inspector AI assist dropdown with 6 actions
- Per-format quick export buttons
- File tree rendering with click-to-attach to selected node

### v2 (Feb 2026, day 1 — Archon PRD gap fill)
- **2 new node types**: `GitHub Context` (auto-populated) + `Prompt Output` (compiled, read-only) → total **14 typed nodes**
- **Auto-creation of GitHub Context node** on repo scan completion with framework summary + README excerpt + file count
- **Typed edge relationships** (depends_on, constrains, implements, references, produces) with colored picker modal on connect + colored labeled edges on canvas
- **AI assist now reads ancestor nodes** (1-hop upstream) + project Coding Rules + repo metadata for grounded context
- **Cmd+. shortcut** for AI assist on selected node (kbd hint in inspector button)
- **F shortcut** + FIT button in header to fit canvas
- **Node completeness indicator**: green check on node header when content > 20 chars
- **Project type at creation**: greenfield / existing codebase / new feature (3-button picker in modal)
- **Save Prompt as Node**: turns generated prompts into Prompt Output node on canvas via "+ SAVE AS NODE" button
- **Save indicator** in header (SAVING / SAVED / SYNCED states)

### v3 (Feb 2026, day 1 — Project templates)
- **Project starter templates**: Blank, SaaS App, CLI Tool, API Service
- Backend `/api/templates` lists available templates; `POST /api/projects` accepts `template` field and seeds 7–9 typed nodes + 6–9 typed edges with pre-filled content for the chosen template
- Frontend create-project modal exposes a 2×2 template grid below project-type picker
- Time-to-first-prompt collapses to <60s for users who pick a template

### v4 (Feb 2026, day 1 — Snapshots: prompt replay + diff viewer)
- **Snapshots collection**: every prompt generation and every export auto-creates a snapshot with `{kind, label, nodes_data, edges_data, metadata}` (full frozen graph + prompt text or export content)
- **Manual checkpoints**: `+ SNAPSHOT` button in canvas header opens a label prompt → stores a `manual` snapshot
- Backend endpoints: `POST/GET /projects/{id}/snapshots`, `GET/DELETE /snapshots/{id}`, `GET /snapshots/{a}/diff/{b}`
- **Diff algorithm** (server-side): node added/removed by id; node modified detected on type/title/content/file_references; edges keyed by `source|target|relationship_type`
- **Prompt replay log**: every snapshot of kind=prompt stores `prompt_template`, `prompt_text`, `extra_instructions`, `focus_node_ids`
- **History page** at `/app/project/:id/history`: chronological snapshot list, 2-checkbox compare flow, side-by-side diff view with line-by-line LCS content diff

### v5 (Feb 2026, day 1 — Prompt threading)
- **Prompt threading**: every new prompt generation now reads (a) the full current graph, (b) up to 3 most recent prior prompt snapshots from `snapshots`, and (c) any `Prompt Output` nodes saved on canvas
- Hardened system prompt instructs Claude to not contradict prior decisions, not duplicate scope, and cite specific node titles
- `link_prior_prompts` flag (default true) lets users opt out per generation
- `GET /api/projects/{id}/prompt-history-count` exposes `{prior_prompts, saved_prompt_nodes}` so the console UI shows live context counters
- Console: new `THREAD PRIOR PROMPTS` checkbox + counter ("2 prior prompts will be passed as context so the new prompt stays consistent")
- AI Expand also pulls saved Prompt Output nodes for node-level grounding
- LLM error mapper: budget_exceeded → 402, rate-limit → 429, context too large → 413, timeout → 504 — sticky toast surfaces "Profile → Universal Key → Add Balance"

### v7 (Feb 2026, day 1 — Quick-start wizard)
- New `/app/backend/wizard.py` deterministically builds a tailored starter graph from 7 inputs: `name`, `description`, `project_kind`, `stack[]`, `features[]`, `team_size`, `ai_tools[]`, `deployment`
- Conditional node seeding: DB Schema only when stack implies persistence or `project_kind ∈ {saas_app, api_service, mobile_app}`; UI Requirements only for client-facing kinds; Deployment node skipped when user picks "Not yet"
- One Feature Scope + one Acceptance Criteria pair per feature (max 4), all wired with typed edges
- AI Coding Rules content branches on selected AI tools (Cursor/Claude Code adds linked-file directive, Copilot adds explicit-imports directive, autonomous agents add halt-on-fail + PR-only directive)
- Testing Instructions depth scales with team size (solo = smoke-test, small = unit+E2E, large = full pyramid)
- Backend endpoint: `POST /api/wizard/generate` creates project + bulk-seeds nodes & edges atomically; stores `wizard_answers` on the project doc
- Frontend `Wizard.jsx` at `/app/wizard`: 6-step linear form with progress bar, chip multi-select for stack + AI tools, radio for kind/team/deploy, expandable feature list (max 4), **live preview sidebar showing the exact node list that will be seeded**
- Dashboard now has `QUICK START WIZARD` button next to `NEW PROJECT`
- Verified live: 7 answers → 12 nodes + 16 typed edges seeded → validation engine returns `ready_for_prompt: true · 0 errors · 0 warnings · 0 infos`
- New `/app/backend/validation.py` with 8 graph rules: no_product_overview, no_coding_rules, disconnected_node, feature_without_acceptance, feature_without_arch, api_without_schema, schema_without_consumer, acceptance_without_feature, arch_without_impl, empty_content
- `POST /api/projects/{id}/validate` returns `{issues:[{node_id, severity, code, message, suggestion}], summary:{error_count, warning_count, info_count, total, ready_for_prompt}}`
- `ValidationPanel.jsx` slides in from the right (swaps with Inspector), shows tile stats + color-coded issue list — clicking jumps to the node
- `CustomNode` now renders a yellow/red/blue ⚠ badge in the header AND tints the node border to the highest-severity issue color (replaces the green ✓)
- Canvas header: `VALIDATE [n]` button with live count badge (amber when warnings, red when errors)
- Validation auto-reruns 800ms after any node/edge mutation, and on canvas load
- **Pre-flight check on `GENERATE PROMPT`**: if `error_count > 0` a confirm modal pops up offering to open the validation panel
- **Snapshots collection**: every prompt generation and every export auto-creates a snapshot with `{kind, label, nodes_data, edges_data, metadata}` (full frozen graph + prompt text or export content)
- **Manual checkpoints**: `+ SNAPSHOT` button in canvas header opens a label prompt → stores a `manual` snapshot
- Backend endpoints: `POST/GET /projects/{id}/snapshots`, `GET/DELETE /snapshots/{id}`, `GET /snapshots/{a}/diff/{b}`
- **Diff algorithm** (server-side): node added/removed by id; node modified detected on type/title/content/file_references; edges keyed by `source|target|relationship_type`
- **Prompt replay log**: every snapshot of kind=prompt stores `prompt_template`, `prompt_text`, `extra_instructions`, `focus_node_ids` — clicking it shows the full markdown prompt + which nodes were focused
- **Export replay log**: kind=export snapshots store `export_format` + `export_content`
- **History page** (`/app/project/:id/history`): chronological list with kind badges (MANUAL / PROMPT / EXPORT), 2-checkbox compare flow, COMPARE button → diff view
- **Diff view**: side-by-side before/after header, 5-stat grid (nodes +/−/~, edges +/−), per-modified-node panel with title diff (strikethrough), line-by-line LCS content diff highlighting added/removed lines, edges added/removed with relationship-colored arrows, file-reference diff
- `/app/frontend/src/lib/diff.js` implements LCS-based line diff
- `HISTORY` link added to canvas header beside `SNAPSHOT`, `FIT`, and `⌘K`

### v8 (Feb 2026, day 1 — Repo refresh + stale-file detection)
- **Prominent `REFRESH REPOSITORY` button** in the REPO sidebar (replaces the tiny icon-only rescan), with last-scan timestamp shown above it (`branch: main · last scan: 5/13/2026, 7:24 PM`)
- Backend `POST /projects/{id}/repository/scan` now also walks every node's `file_references`, compares them against the freshly fetched file tree, and stamps `metadata.stale_file_references` + `metadata.last_rescan_at` on each affected node. Resolved references (file came back) get the stale flag auto-cleared.
- Scan response now includes `stale_summary: {count, nodes:[{node_id, title, type, stale_paths}]}` so the UI can summarize impact
- Toast surfaces stale count after refresh — "Rescan complete · N nodes have stale file references — <titles>"
- `CustomNode` shows an orange `⟳ STALE N` badge in the header, an orange border, and `N/M STALE` footer when stale refs are present (validation issues still take precedence)
- `Inspector` linked-files list highlights stale paths with strikethrough text, orange border, and a `STALE` badge — users can detach with one click
- Verified end-to-end with `octocat/Hello-World`: attach `README` + 2 non-existent paths → refresh → 2/3 stale flagged everywhere; reset to only `README` → flags cleared

## Prioritized backlog (P0/P1/P2)

### Deferred from Archon PRD (post-MVP)
- P1: `@`-mention file picker autocomplete inside content editor
- P1: GitHub OAuth App flow (currently PAT only — user requested PAT for simpler setup)
- P1: Streaming AI responses via SSE
- P2: Undo/redo (Cmd+Z) session-scoped
- P2: Inline expanding editor (currently uses right Inspector)
- P2: Lasso multi-select + Cmd+G node grouping
- P2: Field-by-field AI suggestion accept/reject (currently full replace)
- P2: AI suggestion ghost preview overlay
- P2: Real-time multiplayer
- P2: Vector embeddings + semantic search
- P2: Version history / graph branching
- P2: Custom node type builder
- P2: VS Code / Cursor extension
- P2: Project templates / Quick Start wizard

## Test credentials
See `/app/memory/test_credentials.md`

## Known gaps
- GitHub PAT stored plaintext on user doc (MVP — flag for encryption-at-rest before prod)
- `@app.on_event("shutdown")` deprecated in FastAPI 0.110+ (use lifespan) — non-blocking
- Inspector auto-save useEffect has `node` in body but `[node?.id]` in deps (lint warning only — intentional behaviour)
