import { Link } from "react-router-dom";
import {
  ArrowRight,
  Circuitry,
  GitBranch,
  Brain,
  FileText,
  GraphicsCard,
  Database,
} from "@phosphor-icons/react";
import { NODE_TYPES } from "@/lib/nodeTypes";

const FEATURES = [
  {
    icon: Circuitry,
    title: "Graph-native PRDs",
    body: "Architect projects as living node graphs instead of dead docs. Drag, link, reshape.",
  },
  {
    icon: GitBranch,
    title: "Repo-aware context",
    body: "Connect a GitHub repo. CortexFlow scans the tree, detects frameworks, and grounds every prompt.",
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
  return (
    <div className="min-h-screen bg-cf-bg text-cf-text font-mono">
      {/* nav */}
      <header className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="w-6 h-6 bg-cf-text" />
            <span className="font-display font-black tracking-tighter text-lg">
              CORTEXFLOW
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
              CortexFlow turns your project intent into a graph of connected
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
              "Pick a prompt template; CortexFlow composes a structured prompt.",
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
        <div>© {new Date().getFullYear()} CortexFlow. Built for AI-native devs.</div>
        <div className="flex gap-4">
          <Link to="/login" className="hover:text-cf-text">Sign in</Link>
          <Link to="/register" className="hover:text-cf-text">Get started</Link>
        </div>
      </footer>
    </div>
  );
}
