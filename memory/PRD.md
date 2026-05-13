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
- Verified live: 2nd prompt textually carries 1st prompt's constraints ("One subscription per workspace", "Stripe Customer Portal") under a header `Key business rules` plus a `Billing endpoints (from prior implementation):` section — proving threading works
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
