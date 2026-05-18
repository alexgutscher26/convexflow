import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Circuitry,
  GitBranch,
  Brain,
  FileText,
  GraphicsCard,
  Database,
  Cpu,
  FileCode,
  Lightning,
  Shuffle,
  Chat,
  ShieldWarning,
  User,
  Briefcase,
  Code,
  Terminal,
  WarningCircle,
  ArrowSquareOut,
  X,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import { NODE_TYPES } from "@/lib/nodeTypes";
import packageJson from "../../package.json";

const PAIN_POINTS = [
  {
    id: "context",
    icon: Cpu,
    pain: "AI loses project context",
    solution: "Persistent project memory graph",
    desc: "No more hitting the token limit and losing context midway. ConvexFlow acts as the long-term memory for your AI copilot.",
  },
  {
    id: "inconsistent",
    icon: FileCode,
    pain: "Inconsistent generated code",
    solution: "Architecture-aware prompt generation",
    desc: "AI doesn't guess how to structure files. The graph strictly informs the LLM of your structural architecture.",
  },
  {
    id: "patterns",
    icon: GitBranch,
    pain: "AI ignores existing patterns",
    solution: "GitHub repository context injection",
    desc: "Ground your prompts in real file trees. ConvexFlow maps active branches and files directly to node artifacts.",
  },
  {
    id: "prompts",
    icon: Lightning,
    pain: "Weak prompts produce weak output",
    solution: "Structured modular prompt engine",
    desc: "No more ad-hoc typing. Generate bulletproof system prompts composed from the graph.",
  },
  {
    id: "drift",
    icon: Shuffle,
    pain: "Implementation drift across features",
    solution: "Linked dependency-aware node graph",
    desc: "Every node links to its dependency. Change a schema, and the downstream APIs and tests automatically flag.",
  },
  {
    id: "repeating",
    icon: Chat,
    pain: "Repeating project explanations",
    solution: "Reusable project intelligence layer",
    desc: "Write the spec once. ConvexFlow compiles the entire background stack dynamically for any subsequent task.",
  },
  {
    id: "debt",
    icon: ShieldWarning,
    pain: "Technical debt from AI output",
    solution: "Constraint-driven implementation guidance",
    desc: "Enforce styling, testing, and security boundaries on every prompt to guarantee quality.",
  },
];

const PERSONAS = [
  {
    id: "devs",
    name: "AI-First Developers",
    role: "Cursor & Copilot Users",
    desc: "Developers heavily using tools like Cursor, GitHub Copilot, and autonomous coding agents who need consistent architectural grounding.",
    motivations: [
      "Reduce AI-generated technical debt",
      "Preserve engineering intent across chat histories",
      "Improve AI coding reliability in large files",
    ],
  },
  {
    id: "ctos",
    name: "Startup CTOs",
    role: "Technical Founders",
    desc: "Technical founders managing rapid product iteration with small engineering teams and high AI-assisted development velocity.",
    motivations: [
      "Ship faster without architecture collapse",
      "Maintain strict codebase implementation consistency",
      "Scale AI-assisted development safely across new hires",
    ],
  },
  {
    id: "hackers",
    name: "Indie Hackers",
    role: "Solo Builders",
    desc: "Solo builders using AI tooling to multiply execution speed while maintaining technical consistency and long-term viability.",
    motivations: [
      "Multiply execution speed with flawless consistency",
      "Create reusable, modular engineering context",
      "Build complex features without getting lost in state tracking",
    ],
  },
  {
    id: "engineers",
    name: "AI-Native Product Engineers",
    role: "Multi-System Coordinators",
    desc: "Engineers coordinating implementation across multiple AI coding systems and autonomous agents simultaneously.",
    motivations: [
      "Coordinate multi-perspective AI setups without context loss",
      "Scale developer execution with predictable AI guardrails",
      "Enforce deterministic prompt templates across agents",
    ],
  },
];

const FEATURES = [
  {
    icon: Circuitry,
    title: "Graph-native PRDs",
    body: "Architect projects as living node graphs instead of dead docs. Drag, link, reshape.",
  },
  {
    icon: GitBranch,
    title: "Repo-aware context",
    body: "Connect a GitHub repo. ConvexFlow scans the tree, detects frameworks, and grounds every prompt.",
  },
  {
    icon: Brain,
    title: "Claude 4.5-powered prompts",
    body: "Compose modular prompts from your graph. Export ready-to-paste packs for Cursor & Copilot.",
  },
  {
    icon: FileText,
    title: "Structured exports",
    body: "Markdown PRD, JSON graph, agent context pack — generated in one click.",
  },
  {
    icon: GraphicsCard,
    title: "Persistent memory",
    body: "Conventions, constraints, and decisions stay in the graph and across sessions.",
  },
  {
    icon: Database,
    title: "12 typed node categories",
    body: "Product, architecture, schema, API, tests — every artifact has a place and a color.",
  },
];

export default function Landing() {
  const [activePersona, setActivePersona] = useState("devs");
  return (
    <div className="min-h-screen bg-cf-bg text-cf-text font-mono">
      {/* nav */}
      <header className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="w-6 h-6 bg-cf-text" />
            <span className="font-display font-black tracking-tighter text-lg">
              CONVEXFLOW
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-xs">
            <a
              href="#features"
              className="px-3 py-2 hover:bg-cf-elev text-cf-dim hover:text-cf-text transition-colors"
            >
              FEATURES
            </a>
            <a
              href="#nodes"
              className="px-3 py-2 hover:bg-cf-elev text-cf-dim hover:text-cf-text transition-colors"
            >
              NODES
            </a>
            <a
              href="#workflow"
              className="px-3 py-2 hover:bg-cf-elev text-cf-dim hover:text-cf-text transition-colors"
            >
              WORKFLOW
            </a>
            <Link
              to="/login"
              className="px-3 py-2 hover:bg-cf-elev text-cf-dim hover:text-cf-text transition-colors"
              data-testid="nav-login"
            >
              SIGN IN
            </Link>
            <Link
              to="/register"
              className="ml-2 cf-btn bg-cf-text text-cf-bg px-4 py-2 font-bold hover:bg-zinc-200 transition-colors"
              data-testid="nav-register"
            >
              GET STARTED →
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden border-b border-cf-line">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1737505599162-d9932323a889?crop=entropy&cs=srgb&fm=jpg&q=85&w=2000)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-cf-bg/85" aria-hidden />
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(#3f3f46 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.25,
        }} aria-hidden />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-32 grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8 animate-fade-up">
            <div className="overline mb-6" data-testid="hero-tagline">
              ▸ AI-NATIVE PRD &amp; ENGINEERING ORCHESTRATION
            </div>
            <h1 className="font-display font-black tracking-tighter leading-[0.95] text-5xl sm:text-6xl lg:text-7xl">
              Stop re-explaining
              <br />
              your codebase
              <br />
              <span className="text-cf-dim">to every AI.</span>
            </h1>
            <p className="mt-8 text-sm md:text-base text-cf-dim max-w-2xl leading-relaxed">
              ConvexFlow turns your project intent into a graph of connected
              nodes — architecture, schemas, APIs, conventions — then composes
              repository-aware prompts your AI agents actually follow.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="cf-btn bg-cf-text text-cf-bg px-6 py-3 font-bold inline-flex items-center gap-2 hover:bg-zinc-200 transition-colors"
                data-testid="hero-cta-primary"
              >
                START BUILDING <ArrowRight size={16} weight="bold" />
              </Link>
              <Link
                to="/login"
                className="cf-btn border border-cf-line2 text-cf-text px-6 py-3 font-bold hover:bg-cf-elev transition-colors"
                data-testid="hero-cta-secondary"
              >
                SIGN IN
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:block">
            <div className="border border-cf-line bg-cf-surface p-4 space-y-2">
              <div className="overline">▸ NODE GRAPH</div>
              <div className="space-y-1.5">
                {NODE_TYPES.slice(0, 7).map((n) => (
                  <div
                    key={n.type}
                    className="flex items-center gap-2 px-2 py-1.5 border border-cf-line"
                    style={{ background: "#0a0a0b" }}
                  >
                    <div
                      className="w-2 h-2"
                      style={{ background: n.bg }}
                    />
                    <span className="text-[10px] uppercase tracking-widest text-cf-dim">
                      {n.short}
                    </span>
                    <span className="text-xs ml-auto text-cf-text">
                      {n.type}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-cf-mute pt-2">
                + 5 more node types
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* features bento */}
      <section id="features" className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div>
              <div className="overline mb-3">▸ WHAT IT DOES</div>
              <h2 className="font-display font-black tracking-tighter text-4xl lg:text-5xl">
                Built for AI-first
                <br />
                engineering teams.
              </h2>
            </div>
            <p className="max-w-md text-sm text-cf-dim leading-relaxed">
              Six primitives that compound. Pair them with Cursor, Copilot, or
              any coding agent — they all behave better when grounded in your
              graph.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="border border-cf-line -ml-px -mt-px p-6 hover:bg-cf-surface transition-colors"
                data-testid={`feature-card-${i}`}
              >
                <f.icon size={24} className="text-cf-text" weight="duotone" />
                <h3 className="font-display font-bold text-xl mt-4 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-xs text-cf-dim mt-2 leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* workflow problems & Unified Graph Diagnosis */}
      <section className="border-b border-cf-line bg-cf-surface/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <div className="overline mb-3">▸ THE DIAGNOSIS</div>
              <h2 className="font-display font-black tracking-tighter text-4xl lg:text-5xl leading-none">
                Brittle stacks produce brittle AI.
              </h2>
              <p className="text-sm text-cf-dim mt-6 leading-relaxed">
                Traditional AI coding workflows rely on temporary memory and copy-pasted files. As soon as you scale past single-file tasks, your AI agent loses context, drifts from architecture, and accumulates silent technical debt.
              </p>
              <div className="mt-8 p-4 border border-red-950/40 bg-red-950/10 text-red-400 text-xs flex gap-3">
                <WarningCircle size={18} className="shrink-0 pt-0.5" />
                <span className="leading-normal">
                  Disconnected specifications and manually repeated coding standards produce fragile development pipelines with poor long-term maintainability.
                </span>
              </div>
            </div>
            
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Scattered Stack */}
              <div className="border border-cf-line bg-cf-bg p-6 space-y-4">
                <div className="overline text-red-500/80">▸ THE SCATTERED STACK</div>
                <ul className="space-y-3 text-xs text-cf-dim">
                  <li className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span> Scattered Notion docs
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span> Massive prompt files
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span> Disconnected GitHub references
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span> Copy-pasted instructions
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">✕</span> Temporary AI memory
                  </li>
                </ul>
                <div className="text-[10px] text-cf-mute pt-2 border-t border-cf-line">
                  Result: Brittle development pipelines
                </div>
              </div>

              {/* ConvexFlow Graph */}
              <div className="border border-cf-text bg-cf-text text-cf-bg p-6 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="overline text-cf-bg/60 font-bold">▸ THE CONVEXFLOW WAY</div>
                  <div className="font-display font-black text-2xl tracking-tighter leading-tight mt-2 text-cf-bg">
                    Unified Project Graph
                  </div>
                  <p className="text-xs mt-3 leading-relaxed opacity-95 text-cf-bg">
                    Ground your AI directly in an active repository memory tree. Keep your specifications, architecture, and coding guidelines linked deterministically.
                  </p>
                </div>
                <div className="text-[10px] opacity-75 font-bold pt-4 border-t border-cf-bg/20">
                  Result: Zero context loss, zero drift
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* developer pain points solved table */}
      <section id="pain-points" className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="overline mb-3">▸ THE DIRECT SOLUTION</div>
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-5xl mb-12">
            Developer pain points,
            <br />
            resolved at the source.
          </h2>
          
          <div className="border border-cf-line divide-y divide-cf-line">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-cf-surface text-[10px] uppercase tracking-wider text-cf-mute font-bold">
              <div className="col-span-5">Developer Pain Point</div>
              <div className="col-span-1 text-center">▸</div>
              <div className="col-span-6">ConvexFlow Solution</div>
            </div>
            
            {/* Table Rows */}
            {PAIN_POINTS.map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={item.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-6 items-start hover:bg-cf-surface transition-all group duration-150"
                >
                  {/* Pain Point */}
                  <div className="col-span-12 md:col-span-5 flex items-start gap-3">
                    <span className="text-[10px] font-mono text-cf-mute pt-1 shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-red-400/90 group-hover:text-red-400 transition-colors">
                        {item.pain}
                      </h4>
                      <p className="text-xs text-cf-dim mt-1.5 leading-relaxed hidden md:block">
                        {item.desc.split("ConvexFlow")[0]}
                      </p>
                    </div>
                  </div>
                  
                  {/* Divider/Arrow */}
                  <div className="col-span-12 md:col-span-1 flex md:justify-center items-center py-1 md:py-0">
                    <span className="text-xs text-cf-mute group-hover:text-cf-text transition-colors font-bold">
                      ▸
                    </span>
                  </div>
                  
                  {/* Solution */}
                  <div className="col-span-12 md:col-span-6 flex gap-3">
                    <CheckCircle size={16} className="text-green-500 shrink-0 pt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-cf-text group-hover:text-white transition-colors">
                        {item.solution}
                      </h4>
                      <p className="text-xs text-cf-dim mt-1.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* personas & motivations command deck */}
      <section id="personas" className="border-b border-cf-line bg-cf-surface/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="overline mb-3">▸ WHO IS IT FOR?</div>
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-5xl mb-12">
            Built for the vanguard of
            <br />
            AI-assisted engineering.
          </h2>

          <div className="grid lg:grid-cols-12 border border-cf-line">
            {/* Left Sidebar Tabs (4 Cols) */}
            <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-cf-line bg-cf-bg flex flex-col divide-y divide-cf-line">
              {PERSONAS.map((p) => {
                const isActive = activePersona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePersona(p.id)}
                    className={`w-full text-left px-6 py-5 transition-all flex flex-col gap-1 focus:outline-none ${
                      isActive 
                        ? "bg-cf-text text-cf-bg" 
                        : "hover:bg-cf-elev text-cf-dim hover:text-cf-text"
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      isActive ? "text-cf-bg/60" : "text-cf-mute"
                    }`}>
                      {p.role}
                    </span>
                    <span className="text-sm font-display font-bold">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Details Deck (8 Cols) */}
            <div className="lg:col-span-8 bg-cf-bg flex flex-col">
              {/* Terminal Header Bar */}
              <div className="px-6 py-3 border-b border-cf-line bg-cf-surface flex items-center justify-between text-[10px] text-cf-mute font-mono">
                <span>CONSOLE_DECK_V2 // PERSONA_MOTIVATIONS</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-cf-line2 rounded-full"></span>
                  <span className="w-1.5 h-1.5 bg-cf-line2 rounded-full"></span>
                  <span className="w-1.5 h-1.5 bg-cf-line2 rounded-full"></span>
                </div>
              </div>

              {/* Content Viewport */}
              <div className="p-8 space-y-8 flex-1 flex flex-col justify-between">
                {PERSONAS.map((p) => {
                  if (p.id !== activePersona) return null;
                  return (
                    <div key={p.id} className="space-y-6 animate-fade-up">
                      <div>
                        <h3 className="text-2xl font-display font-black tracking-tight text-cf-text">
                          {p.name}
                        </h3>
                        <p className="text-xs text-cf-mute mt-1 font-mono uppercase tracking-widest">
                          ▸ {p.role}
                        </p>
                        <p className="text-sm text-cf-dim mt-4 leading-relaxed max-w-2xl">
                          {p.desc}
                        </p>
                      </div>

                      <div className="border-t border-cf-line pt-6">
                        <div className="overline mb-4 text-cf-text">▸ Core Motivations</div>
                        <ul className="grid sm:grid-cols-2 gap-4">
                          {p.motivations.map((m, i) => (
                            <li 
                              key={i} 
                              className="flex items-start gap-2.5 p-3 border border-cf-line bg-cf-surface/40 hover:bg-cf-surface hover:border-cf-line2 transition-all duration-150"
                            >
                              <span className="text-green-500 font-bold shrink-0 text-xs">▸</span>
                              <span className="text-xs text-cf-text leading-relaxed">
                                {m}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}

                <div className="text-[10px] text-cf-mute pt-6 border-t border-cf-line flex items-center justify-between">
                  <span>TARGET_STATUS: ACTIVE</span>
                  <Link to="/register" className="text-cf-text hover:underline flex items-center gap-1">
                    JOIN CONVEXFLOW NOW <ArrowRight size={10} weight="bold" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* nodes showcase */}
      <section id="nodes" className="border-b border-cf-line bg-cf-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="overline mb-3">▸ 12 NODE TYPES</div>
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-5xl mb-12">
            One color per intent.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {NODE_TYPES.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.type}
                  className="border border-cf-line bg-cf-bg"
                  data-testid={`node-card-${n.short}`}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ background: n.bg, color: n.text }}
                  >
                    <Icon size={14} weight="bold" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">
                      {n.short}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-bold text-cf-text">{n.type}</div>
                    <div className="text-[11px] text-cf-mute mt-1 leading-snug">
                      {n.blurb}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* workflow */}
      <section id="workflow" className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="overline mb-3">▸ WORKFLOW</div>
            <h2 className="font-display font-black tracking-tighter text-4xl lg:text-5xl">
              From intent to
              <br />
              implementation.
            </h2>
            <p className="text-sm text-cf-dim mt-6 leading-relaxed">
              The fastest path between an idea and code your AI doesn't have
              to be corrected three times.
            </p>
          </div>
          <ol className="lg:col-span-8 space-y-0">
            {[
              "Spin up a project and connect a GitHub repo.",
              "Drag in nodes: product overview, architecture, schemas, API contracts.",
              "Link nodes to express dependencies and inheritance.",
              "Tag files from the repo tree directly to architecture nodes.",
              "Pick a prompt template; ConvexFlow composes a structured prompt.",
              "Export Markdown PRD, JSON graph, or AI-agent context pack.",
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-4 border border-cf-line -mt-px p-6 items-start"
              >
                <span className="font-display font-black text-2xl text-cf-mute w-10 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm text-cf-text leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* cta */}
      <section className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 text-center">
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-6xl">
            Your AI will thank you.
          </h2>
          <p className="text-sm text-cf-dim mt-6 max-w-xl mx-auto">
            Free to try. No credit card. Bring your own repo or start from a
            template.
          </p>
          <Link
            to="/register"
            className="cf-btn inline-flex items-center gap-2 bg-cf-text text-cf-bg px-8 py-4 font-bold mt-10 hover:bg-zinc-200 transition-colors"
            data-testid="cta-bottom"
          >
            CREATE FREE ACCOUNT <ArrowRight size={18} weight="bold" />
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex items-center justify-between flex-wrap gap-4 text-xs text-cf-mute">
        <div>© {new Date().getFullYear()} ConvexFlow v{packageJson.version}. Built for AI-native devs.</div>
        <div className="flex gap-4">
          <Link to="/login" className="hover:text-cf-text">Sign in</Link>
          <Link to="/register" className="hover:text-cf-text">Get started</Link>
        </div>
      </footer>
    </div>
  );
}
