import { useState, useEffect } from "react";
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
  Terminal,
  WarningCircle,
  CheckCircle,
  Warning,
  Gear,
  Circle,
  CaretRight,
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
    icon: FileCode,
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
  const [selectedNodes, setSelectedNodes] = useState({
    OVERVIEW: true,
    ARCH: false,
    DB: true,
    API: false,
    RULES: true,
    TEST: false,
  });
  const [compiling, setCompiling] = useState(false);
  const [compileOutput, setCompileOutput] = useState("");

  const toggleNode = (nodeKey) => {
    setCompiling(true);
    setSelectedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  useEffect(() => {
    if (!compiling) return;
    const timer = setTimeout(() => {
      setCompiling(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [compiling]);

  useEffect(() => {
    let lines = [];
    lines.push("# CONVEXFLOW DYNAMIC SYSTEM PROMPT CONTEXT");
    lines.push("## TARGET: Claude-3.5-Sonnet / Cursor agentic-mode");
    lines.push("");

    if (selectedNodes.OVERVIEW) {
      lines.push("### [NODE_BIND: OVERVIEW]");
      lines.push("- Target: Build a high-performance in-memory cache manager.");
      lines.push("- Constraints: Under 5ms write, strict eviction logs.");
    }
    if (selectedNodes.ARCH) {
      lines.push("### [NODE_BIND: ARCHITECTURE]");
      lines.push("- Topology: Redis memory store cluster + write-back queue.");
      lines.push("- Threading: Single-process event loop, non-blocking I/O.");
    }
    if (selectedNodes.DB) {
      lines.push("### [NODE_BIND: DATABASE SCHEMA]");
      lines.push("- Entities: Session { id: uuid, data: json, expires_at: timestamp }");
      lines.push("- Indexing: Hash index on session.id, B-tree on expires_at.");
    }
    if (selectedNodes.API) {
      lines.push("### [NODE_BIND: API CONTRACTS]");
      lines.push("- Routes: POST /api/cache (payload: {key, val, ttl}) -> 201 Created.");
      lines.push("- Routes: GET /api/cache/:key -> 200 OK | 404 Not Found.");
    }
    if (selectedNodes.RULES) {
      lines.push("### [NODE_BIND: CODING RULES]");
      lines.push("- P0: Zero purple gradients or rounded borders on output screens.");
      lines.push("- P1: Return errors as values, throw statements are forbidden.");
    }
    if (selectedNodes.TEST) {
      lines.push("### [NODE_BIND: TESTING INSTRUCTIONS]");
      lines.push("- Pattern: Arrange-Act-Assert structure only.");
      lines.push("- Coverage: 100% path coverage on caching middleware.");
    }

    setCompileOutput(lines.join("\n"));
  }, [selectedNodes]);

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text font-mono selection:bg-cf-text selection:text-cf-bg">
      {/* nav */}
      <header className="border-b border-cf-line bg-cf-bg z-50 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="w-4 h-4 bg-cf-text rotate-45" />
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
              className="ml-2 btn-stark px-4 py-2 font-bold hover:bg-cf-text hover:text-cf-bg"
              data-testid="nav-register"
            >
              GET STARTED →
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section - Typographic Brutalism & Interactive Prompt Compiler Cockpit */}
      <section className="relative overflow-hidden border-b border-cf-line pt-20 pb-24">
        {/* Technical background grids */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(to right, #1f1f23 1px, transparent 1px), linear-gradient(to bottom, #1f1f23 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          opacity: 0.15,
        }} aria-hidden />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 flex flex-col items-center">
          {/* Tagline */}
          <div className="overline mb-6 text-orange-500 animate-tech-glitch select-none" data-testid="hero-tagline">
            ▸ BINDING CODEBASE ARTIFACTS TO DETERMINISTIC PROMPTS
          </div>
          
          {/* Centered Massive Typographic Headline */}
          <h1 className="font-display font-black tracking-tighter leading-[0.9] text-center text-5xl sm:text-7xl lg:text-[85px] max-w-5xl uppercase select-none">
            Stop re-explaining
            <br />
            your codebase
            <br />
            <span className="text-cf-dim">to every AI agent.</span>
          </h1>

          <p className="mt-8 text-sm md:text-base text-cf-dim max-w-2xl text-center leading-relaxed font-mono">
            ConvexFlow compiles your system specification tree—schemas, API endpoints, testing conventions, and repo architecture—into deterministic context binders that ground Cursor, Copilot, or multi-agent configurations.
          </p>

          <div className="mt-8 flex gap-3 z-10">
            <Link
              to="/register"
              className="btn-stark px-6 py-3 font-bold inline-flex items-center gap-2 text-sm hover:bg-cf-text hover:text-cf-bg"
              data-testid="hero-cta-primary"
            >
              START BUILDING <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 border border-cf-line2 text-cf-text font-bold text-sm bg-cf-surface hover:bg-cf-elev transition-colors"
              data-testid="hero-cta-secondary"
            >
              SIGN IN
            </Link>
          </div>

          {/* Interactive Prompt Compiler Widget (Cockpit Layout) */}
          <div className="mt-16 w-full border border-cf-line bg-cf-bg grid lg:grid-cols-12 max-w-6xl">
            {/* Widget Left: Control Panel Switcher */}
            <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-cf-line space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-cf-line pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Gear className="text-orange-500 animate-spin" size={16} />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-cf-text">
                      COMPILER_CONTROL_DECK
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    <span className="text-[9px] text-orange-500 font-bold uppercase tracking-wider">LIVE</span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-cf-text mb-2">
                  Toggle nodes to update prompt:
                </h3>
                <p className="text-xs text-cf-dim leading-relaxed mb-4">
                  Add architecture constraints, database structures, or testing instructions. ConvexFlow instantly compiles the context packet.
                </p>

                {/* Node Buttons */}
                <div className="space-y-2">
                  {[
                    { key: "OVERVIEW", label: "Product Overview", bg: "#FAFAFA", text: "#0A0A0B", border: "#A1A1AA" },
                    { key: "ARCH", label: "Technical Architecture", bg: "#EAB308", text: "#0A0A0B", border: "#CA8A04" },
                    { key: "DB", label: "Database Schema", bg: "#10B981", text: "#0A0A0B", border: "#059669" },
                    { key: "API", label: "API Contracts", bg: "#EF4444", text: "#FFFFFF", border: "#DC2626" },
                    { key: "RULES", label: "AI Coding Rules", bg: "#06B6D4", text: "#0A0A0B", border: "#0891B2" },
                    { key: "TEST", label: "Testing Instructions", bg: "#F43F5E", text: "#FFFFFF", border: "#E11D48" },
                  ].map((node) => {
                    const active = selectedNodes[node.key];
                    return (
                      <button
                        key={node.key}
                        onClick={() => toggleNode(node.key)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 border transition-none focus:outline-none ${
                          active 
                            ? "bg-cf-elev border-cf-line2 text-cf-text" 
                            : "bg-cf-bg border-cf-line text-cf-mute hover:border-cf-line2 hover:text-cf-dim"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-2 h-2 shrink-0" 
                            style={{ background: active ? node.bg : "#3f3f46" }} 
                          />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {node.label}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold ${active ? "text-orange-500" : "text-cf-mute"}`}>
                          {active ? "[ BINDED ]" : "[ UNUSED ]"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-cf-line pt-4 text-[10px] text-cf-mute flex justify-between items-center">
                <span>ACTIVE_BINDERS: {Object.values(selectedNodes).filter(Boolean).length} / 6</span>
                <span>BASED ON SWISS ARCHETYPE</span>
              </div>
            </div>

            {/* Widget Right: Live Terminal CRT View */}
            <div className="lg:col-span-7 bg-[#0d0d0f] flex flex-col crt-scanlines">
              {/* Terminal Title Bar */}
              <div className="px-5 py-3 border-b border-cf-line bg-cf-surface flex items-center justify-between text-[10px] font-bold text-cf-mute">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-orange-500" />
                  <span>CONVEXFLOW_COMPILER_V3 // TERMINAL_OUTPUT</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${compiling ? "bg-orange-500 animate-ping" : "bg-emerald-500"}`}></span>
                  <span className={compiling ? "text-orange-500" : "text-emerald-500"}>
                    {compiling ? "COMPILING..." : "SUCCESS_SYNC"}
                  </span>
                </div>
              </div>

              {/* Terminal Viewport */}
              <div className="p-6 flex-1 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[360px] text-emerald-400 space-y-4">
                {compiling ? (
                  <div className="space-y-2 animate-pulse">
                    <p className="text-orange-400 font-bold">▸ SCANNING ACTIVE SYSTEM CORE...</p>
                    <p className="text-cf-dim">▸ Binding repository trees...</p>
                    <p className="text-cf-dim">▸ Compiling constraints schema...</p>
                    <p className="text-cf-dim">▸ Resolving architectural graph dependencies...</p>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-emerald-500/90 font-mono">
                    {compileOutput}
                  </pre>
                )}
                
                {/* Blinking CLI Line */}
                <div className="flex items-center gap-1 border-t border-cf-line pt-2 text-cf-mute">
                  <CaretRight size={10} weight="bold" />
                  <span>cortex-compiler-service --active-binds</span>
                  <span className="w-1.5 h-3 bg-emerald-500 animate-cursor-blink"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Asymmetric Stark Grid Features Section */}
      <section id="features" className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="overline mb-4 text-orange-500">▸ THE ENGINE</div>
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-6xl mb-16 uppercase">
            Built for technical teams
            <br />
            who compile code with AI.
          </h2>

          {/* Stark Asymmetric Rows Grid (Betraying Bento layout) */}
          <div className="border border-cf-line divide-y divide-cf-line">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const isEven = i % 2 === 0;
              return (
                <div 
                  key={f.title} 
                  className="tech-grid-cols transition-none group"
                  data-testid={`feature-card-${i}`}
                >
                  {/* Title Col */}
                  <div className={`p-8 border-cf-line flex flex-col justify-between ${
                    isEven 
                      ? "border-b lg:border-b-0 lg:border-r bg-cf-surface/20 group-hover:bg-cf-surface" 
                      : "border-b lg:border-b-0 lg:border-r order-1 lg:order-2 bg-cf-surface/40 group-hover:bg-cf-surface"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cf-mute font-bold">
                        FEATURE_BLOCK_0{i + 1}
                      </span>
                      <Icon size={20} className="text-cf-text group-hover:text-orange-500 transition-colors" weight="duotone" />
                    </div>
                    <h3 className="font-display font-black text-2xl lg:text-3xl mt-12 tracking-tight uppercase">
                      {f.title}
                    </h3>
                  </div>

                  {/* Body Col */}
                  <div className={`p-8 flex flex-col justify-center ${
                    isEven 
                      ? "order-2 bg-cf-bg group-hover:bg-cf-surface/10" 
                      : "order-2 lg:order-1 bg-cf-bg group-hover:bg-cf-surface/10"
                  }`}>
                    <p className="text-sm text-cf-dim leading-relaxed max-w-xl">
                      {f.body}
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-[10px] text-orange-500 font-bold uppercase tracking-wider">
                      <span>determinism index: 1.0</span>
                      <span>•</span>
                      <span>active sync ready</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Scattered Stack diagnostics and Unified Graph */}
      <section className="border-b border-cf-line bg-cf-surface/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="grid lg:grid-cols-12 gap-16 items-start">
            <div className="lg:col-span-5">
              <div className="overline mb-4 text-red-500">▸ CONTEXT DEGRADATION DIAGNOSIS</div>
              <h2 className="font-display font-black tracking-tighter text-4xl lg:text-5xl leading-none uppercase">
                Brittle spec stacks produce drift.
              </h2>
              <p className="text-sm text-cf-dim mt-6 leading-relaxed">
                Manually copying file snapshots into Cursor or Copilot fails because temporary token windows forget context. When dynamic codebases shift, ungrounded prompts accumulate visual, architectural, and security drift.
              </p>
              <div className="mt-8 p-4 border border-red-950/40 bg-red-950/20 text-red-400 text-xs flex gap-3 rounded-none">
                <WarningCircle size={18} className="shrink-0 pt-0.5" />
                <span className="leading-normal font-mono">
                  ERROR: Disconnected prompt templates generate stale implementation targets. Upstream structural updates are not detected by standard chat histories.
                </span>
              </div>
            </div>
            
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Scattered Stack Console */}
              <div className="border border-red-950/40 bg-red-950/5 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="overline text-red-500 font-bold">▸ UNGROUNDED_WORKFLOW</div>
                  <Warning className="text-red-500 animate-pulse" size={14} />
                </div>
                <div className="font-display font-black text-lg text-red-400">CONTEXT DRIFT OUTCOMES</div>
                <ul className="space-y-3 text-xs text-cf-dim font-mono">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>Stale Notion &amp; PRD markdown files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>AI hallucinating library API versions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>Ignoring project linting restrictions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>Context-window limit resets</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                    <span>Silent tech debt compile fails</span>
                  </li>
                </ul>
                <div className="text-[10px] text-red-500/80 pt-2 border-t border-red-950/20">
                  STATUS: HIGHLY UNSTABLE
                </div>
              </div>

              {/* ConvexFlow Graph Console */}
              <div className="border border-cf-text bg-cf-text text-cf-bg p-6 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="overline text-cf-bg/60 font-bold">▸ CONVEXFLOW_GRAPH_BINDER</div>
                    <CheckCircle className="text-cf-bg" size={14} />
                  </div>
                  <div className="font-display font-black text-2xl tracking-tighter leading-tight mt-2 text-cf-bg">
                    DETERMINISTIC INTENT TREE
                  </div>
                  <p className="text-xs mt-3 leading-relaxed text-cf-bg/95 font-mono">
                    Direct local sync scanning maps your codebase schemas to constraints. Downstream endpoints instantly flag updates when schema models change.
                  </p>
                </div>
                <div className="text-[10px] opacity-75 font-bold pt-4 border-t border-cf-bg/20">
                  STATUS: SYNCED &amp; ALIGNED
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developer pain points solved table */}
      <section id="pain-points" className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="overline mb-4 text-orange-500">▸ REMEDIES</div>
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-6xl mb-16 uppercase">
            Pain points resolved
            <br />
            at the architecture level.
          </h2>
          
          <div className="border border-cf-line divide-y divide-cf-line bg-cf-bg">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-cf-surface text-[10px] uppercase tracking-wider text-cf-mute font-bold">
              <div className="col-span-5">Ungrounded Pain Point</div>
              <div className="col-span-1 text-center">▸</div>
              <div className="col-span-6">ConvexFlow Resolution</div>
            </div>
            
            {/* Table Rows */}
            {PAIN_POINTS.map((item, index) => {
              return (
                <div 
                  key={item.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-6 items-start hover:bg-cf-surface/20 transition-none group"
                >
                  {/* Pain Point */}
                  <div className="col-span-12 md:col-span-5 flex items-start gap-3">
                    <span className="text-[10px] font-mono text-cf-mute pt-1 shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-orange-500 uppercase">
                        {item.pain}
                      </h4>
                      <p className="text-xs text-cf-dim mt-1.5 leading-relaxed hidden md:block">
                        {item.desc.split("ConvexFlow")[0]}
                      </p>
                    </div>
                  </div>
                  
                  {/* Divider/Arrow */}
                  <div className="col-span-12 md:col-span-1 flex md:justify-center items-center py-1 md:py-0">
                    <span className="text-xs text-cf-mute group-hover:text-cf-text font-bold">
                      ▸
                    </span>
                  </div>
                  
                  {/* Solution */}
                  <div className="col-span-12 md:col-span-6 flex gap-3">
                    <CheckCircle size={16} className="text-emerald-500 shrink-0 pt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-cf-text group-hover:text-white transition-colors">
                        {item.solution}
                      </h4>
                      <p className="text-xs text-cf-dim mt-1.5 leading-relaxed font-mono">
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

      {/* Personas Console Deck */}
      <section id="personas" className="border-b border-cf-line bg-cf-surface/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="overline mb-4 text-orange-500">▸ USER TARGETS</div>
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-6xl mb-16 uppercase">
            Engineered for developer workflows.
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
                    className={`w-full text-left px-6 py-5 flex flex-col gap-1 focus:outline-none transition-none ${
                      isActive 
                        ? "bg-cf-text text-cf-bg" 
                        : "hover:bg-cf-surface text-cf-dim hover:text-cf-text"
                    }`}
                  >
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${
                      isActive ? "text-cf-bg/60" : "text-cf-mute"
                    }`}>
                      {p.role}
                    </span>
                    <span className="text-sm font-display font-black uppercase">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Details Deck (8 Cols) */}
            <div className="lg:col-span-8 bg-cf-bg flex flex-col">
              {/* Terminal Header Bar */}
              <div className="px-6 py-3 border-b border-cf-line bg-cf-surface flex items-center justify-between text-[9px] text-cf-mute font-bold font-mono">
                <span>CONSOLE_DECK_V3 // TELEMETRY_PERSONA</span>
                <div className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-cf-line2 rounded-full"></span>
                  <span className="w-1 h-1 bg-cf-line2 rounded-full"></span>
                  <span className="w-1 h-1 bg-cf-line2 rounded-full"></span>
                </div>
              </div>

              {/* Content Viewport */}
              <div className="p-8 space-y-8 flex-1 flex flex-col justify-between min-h-[300px]">
                {PERSONAS.map((p) => {
                  if (p.id !== activePersona) return null;
                  return (
                    <div key={p.id} className="space-y-6 animate-fade-up">
                      <div>
                        <h3 className="text-2xl font-display font-black uppercase tracking-tight text-cf-text">
                          {p.name}
                        </h3>
                        <p className="text-xs text-orange-500 mt-1 font-mono uppercase tracking-widest">
                          ▸ {p.role}
                        </p>
                        <p className="text-xs text-cf-dim mt-4 leading-relaxed max-w-2xl font-mono">
                          {p.desc}
                        </p>
                      </div>

                      <div className="border-t border-cf-line pt-6">
                        <div className="overline mb-4 text-cf-text">▸ Critical Alignment Needs</div>
                        <ul className="grid sm:grid-cols-2 gap-4">
                          {p.motivations.map((m, i) => (
                            <li 
                              key={i} 
                              className="flex items-start gap-2.5 p-3 border border-cf-line bg-cf-surface/20 hover:border-cf-line2 transition-none"
                            >
                              <span className="text-orange-500 font-bold shrink-0 text-xs">▸</span>
                              <span className="text-xs text-cf-text leading-relaxed font-mono">
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
                  <span>TARGET_STATUS: DEPLOYED</span>
                  <Link to="/register" className="text-cf-text hover:underline flex items-center gap-1 font-bold">
                    INITIALIZE CONTEXT GRAPH <ArrowRight size={10} weight="bold" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nodes Showcase */}
      <section id="nodes" className="border-b border-cf-line bg-cf-surface/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="overline mb-4 text-orange-500">▸ METADATA TYPES</div>
          <h2 className="font-display font-black tracking-tighter text-4xl lg:text-6xl mb-16 uppercase">
            12 typed node primitives.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {NODE_TYPES.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.type}
                  className="border border-cf-line bg-cf-bg flex flex-col justify-between"
                  data-testid={`node-card-${n.short}`}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b border-cf-line"
                    style={{ background: "#0a0a0b" }}
                  >
                    <div className="w-1.5 h-1.5 shrink-0" style={{ background: n.bg }} />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-cf-text">
                      {n.short}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-cf-text mb-2">{n.type}</div>
                      <div className="text-[11px] text-cf-mute leading-snug font-mono">
                        {n.blurb}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-cf-line/50 flex items-center gap-2 text-[9px] text-cf-mute font-mono">
                      <Icon size={12} />
                      <span>TEMPLATE BIND READY</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div>
              <div className="overline mb-4 text-orange-500">▸ PROCEDURES</div>
              <h2 className="font-display font-black tracking-tighter text-4xl lg:text-6xl uppercase">
                Deterministic pipeline.
              </h2>
              <p className="text-sm text-cf-dim mt-6 leading-relaxed font-mono">
                Bypass manual instruction typing. Lock specification dependencies once, then stream context packets to any LLM interface.
              </p>
            </div>
            <div className="hidden lg:block text-[10px] text-cf-mute font-mono border-t border-cf-line pt-4">
              COMPILE_SEQUENCE_V4
            </div>
          </div>
          
          <ol className="lg:col-span-8 space-y-0 border-t border-cf-line">
            {[
              "Spin up a workspace project and link a local GitHub repository.",
              "Construct graph nodes representing specs, database schemas, and contracts.",
              "Connect nodes to assert structural constraints and dependencies.",
              "Anchor active branches and code files to their respective specs.",
              "Formulate a prompt archetype package composed directly from the tree.",
              "Compile and sync context binders to Cursor, Copilot, or multi-agent tools.",
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-6 border-b border-l border-r border-cf-line p-6 items-start hover:bg-cf-surface/10 transition-none group"
              >
                <span className="font-display font-black text-2xl text-cf-mute group-hover:text-orange-500 transition-colors w-10 shrink-0 select-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-xs text-cf-text leading-relaxed font-mono pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Action CTA */}
      <section className="border-b border-cf-line py-28 text-center bg-cf-surface/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <h2 className="font-display font-black tracking-tighter text-5xl lg:text-7xl uppercase select-none">
            Your AI will work better.
          </h2>
          <p className="text-xs md:text-sm text-cf-dim mt-6 max-w-xl mx-auto font-mono">
            Zero cost to spin up. Import code schemas directly, connect a repository, and output aligned prompts.
          </p>
          <Link
            to="/register"
            className="btn-stark px-8 py-4 font-bold mt-10 hover:bg-cf-text hover:text-cf-bg inline-block text-sm"
            data-testid="cta-bottom"
          >
            CREATE FREE ACCOUNT <ArrowRight size={18} className="inline ml-1" weight="bold" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex items-center justify-between flex-wrap gap-4 text-[10px] text-cf-mute font-mono">
        <div>© {new Date().getFullYear()} ConvexFlow v{packageJson.version}. Engineered for aligned AI pipelines.</div>
        <div className="flex gap-6 font-bold">
          <Link to="/login" className="hover:text-cf-text">SIGN IN</Link>
          <Link to="/register" className="hover:text-cf-text">GET STARTED</Link>
        </div>
      </footer>
    </div>
  );
}
