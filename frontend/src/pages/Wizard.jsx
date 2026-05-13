import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Sparkle,
  Check,
  Plus,
  Minus,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";

const PROJECT_KINDS = [
  { v: "saas_app", l: "SaaS App", d: "Multi-tenant web app with auth + billing." },
  { v: "web_app", l: "Web App", d: "Single-tenant or static web app." },
  { v: "api_service", l: "API Service", d: "Backend-only REST/GraphQL API." },
  { v: "cli_tool", l: "CLI Tool", d: "Command-line utility." },
  { v: "mobile_app", l: "Mobile App", d: "iOS / Android native or RN." },
  { v: "ai_ml", l: "AI / ML", d: "Model training, inference, agent stack." },
];

const STACK_OPTIONS = [
  "Next.js", "React", "Vue", "Svelte", "Astro",
  "FastAPI", "Express", "NestJS", "Django", "Go",
  "Postgres", "MongoDB", "MySQL",
  "Prisma", "Drizzle", "SQLAlchemy",
  "Tailwind", "Stripe", "Redis",
];

const AI_TOOLS = [
  "Cursor", "Claude Code", "Copilot", "Continue.dev",
  "Autonomous agents", "Devin", "v0", "Aider",
];

const TEAM = [
  { v: "solo", l: "Solo", d: "Just me." },
  { v: "small", l: "2–5", d: "Small team." },
  { v: "large", l: "6+", d: "Larger team or org." },
];

const DEPLOY = [
  { v: "vercel", l: "Vercel" },
  { v: "aws", l: "AWS" },
  { v: "docker", l: "Docker / k8s" },
  { v: "fly", l: "Fly.io" },
  { v: "railway", l: "Railway" },
  { v: "none", l: "Not yet" },
];

function ChipGroup({ options, value, onChange, dataPrefix }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((v) => v !== o) : [...value, o])
            }
            className={`cf-btn border px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold transition-colors ${
              active
                ? "bg-cf-text text-cf-bg border-cf-text"
                : "border-cf-line text-cf-dim hover:bg-cf-elev"
            }`}
            data-testid={`${dataPrefix}-${o.toLowerCase().replace(/[^a-z0-9]/g, "_")}`}
          >
            {active && <Check size={10} className="inline mr-1" weight="bold" />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Radio({ options, value, onChange, dataPrefix }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`cf-btn border px-3 py-3 text-left transition-colors ${
              active
                ? "bg-cf-elev border-cf-text"
                : "border-cf-line hover:bg-cf-elev"
            }`}
            data-testid={`${dataPrefix}-${o.v}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-widest">
              {o.l}
            </div>
            {o.d && (
              <div className="text-[10px] text-cf-mute mt-1">{o.d}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

const STEPS = [
  { id: "basics", title: "Basics" },
  { id: "kind", title: "What" },
  { id: "stack", title: "Stack" },
  { id: "features", title: "Features" },
  { id: "team", title: "Team & AI" },
  { id: "deploy", title: "Deploy" },
];

export default function Wizard() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectKind, setProjectKind] = useState("saas_app");
  const [stack, setStack] = useState([]);
  const [features, setFeatures] = useState([""]);
  const [teamSize, setTeamSize] = useState("solo");
  const [aiTools, setAiTools] = useState([]);
  const [deployment, setDeployment] = useState("vercel");

  const cleanFeatures = features.map((f) => f.trim()).filter(Boolean);

  // live preview of nodes that will be seeded
  const previewNodes = useMemo(() => {
    const list = ["Product Overview", "Technical Architecture", "AI Coding Rules"];
    if (cleanFeatures.length) {
      for (let i = 0; i < Math.min(4, cleanFeatures.length); i++)
        list.push(`Feature Scope: ${cleanFeatures[i].slice(0, 28)}`);
    } else {
      list.push("Feature Scope (placeholder)");
    }
    const needsDb =
      stack.some((s) =>
        ["Postgres", "MongoDB", "MySQL", "Prisma", "Drizzle", "SQLAlchemy"].includes(s),
      ) ||
      ["saas_app", "api_service", "mobile_app"].includes(projectKind);
    const needsApi = ["saas_app", "web_app", "api_service", "mobile_app"].includes(
      projectKind,
    );
    const needsUi = ["saas_app", "web_app", "mobile_app"].includes(projectKind);
    if (needsDb) list.push("Database Schema");
    if (needsApi) list.push("API Contracts");
    if (needsUi) list.push("UI Requirements");
    const featCount = Math.max(1, Math.min(4, cleanFeatures.length || 1));
    for (let i = 0; i < featCount; i++) list.push("Acceptance Criteria");
    if (deployment !== "none") list.push("Deployment Requirements");
    list.push("Testing Instructions");
    return list;
  }, [cleanFeatures, stack, projectKind, deployment]);

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/wizard/generate", {
        name: name.trim(),
        description: description.trim(),
        project_kind: projectKind,
        stack,
        features: cleanFeatures,
        team_size: teamSize,
        ai_tools: aiTools,
        deployment,
      });
      toast.success(`Project seeded with ${previewNodes.length} nodes`);
      nav(`/app/project/${data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Wizard failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text font-mono">
      <header className="h-14 border-b border-cf-line flex items-center px-6">
        <Link to="/app" className="flex items-center gap-2 text-xs text-cf-dim hover:text-cf-text" data-testid="wizard-back">
          <ArrowLeft size={14} /> PROJECTS
        </Link>
        <div className="w-px h-5 bg-cf-line mx-3" />
        <div className="flex items-center gap-2 text-xs font-bold">
          <Sparkle size={14} weight="fill" className="text-amber-400" /> QUICK START
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-10 py-10 grid lg:grid-cols-12 gap-8">
        {/* main column */}
        <div className="lg:col-span-8">
          {/* step progress */}
          <div className="flex items-center gap-1 mb-8 overflow-x-auto" data-testid="wizard-progress">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`flex-1 px-2 py-1.5 border-b-2 transition-colors ${
                  i === step
                    ? "border-cf-text text-cf-text"
                    : i < step
                      ? "border-emerald-700 text-emerald-400"
                      : "border-cf-line text-cf-mute"
                }`}
              >
                <div className="text-[9px] uppercase tracking-widest font-bold">
                  STEP {i + 1}
                </div>
                <div className="text-xs font-bold">{s.title}</div>
              </div>
            ))}
          </div>

          {step === 0 && (
            <section data-testid="step-basics">
              <div className="overline mb-2">▸ STEP 1 · BASICS</div>
              <h1 className="font-display font-black text-4xl tracking-tighter mb-6">
                Name your project.
              </h1>
              <label className="block mb-4">
                <span className="overline">PROJECT NAME</span>
                <input
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Billing Engine"
                  className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
                  data-testid="wizard-name"
                />
              </label>
              <label className="block">
                <span className="overline">ONE-LINER (OPTIONAL)</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A multi-tenant subscription billing platform for B2B SaaS."
                  className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text resize-none"
                  data-testid="wizard-description"
                />
              </label>
            </section>
          )}

          {step === 1 && (
            <section data-testid="step-kind">
              <div className="overline mb-2">▸ STEP 2 · KIND</div>
              <h1 className="font-display font-black text-4xl tracking-tighter mb-6">
                What are you building?
              </h1>
              <Radio
                options={PROJECT_KINDS}
                value={projectKind}
                onChange={setProjectKind}
                dataPrefix="wizard-kind"
              />
            </section>
          )}

          {step === 2 && (
            <section data-testid="step-stack">
              <div className="overline mb-2">▸ STEP 3 · STACK</div>
              <h1 className="font-display font-black text-4xl tracking-tighter mb-2">
                Pick your stack.
              </h1>
              <p className="text-sm text-cf-dim mb-6">
                Pick whatever applies. We'll wire matching nodes (DB schema,
                API contracts) and stack-aware prompts.
              </p>
              <ChipGroup
                options={STACK_OPTIONS}
                value={stack}
                onChange={setStack}
                dataPrefix="wizard-stack"
              />
            </section>
          )}

          {step === 3 && (
            <section data-testid="step-features">
              <div className="overline mb-2">▸ STEP 4 · FEATURES</div>
              <h1 className="font-display font-black text-4xl tracking-tighter mb-2">
                Top features (up to 4).
              </h1>
              <p className="text-sm text-cf-dim mb-6">
                One per row. Each becomes a Feature Scope node wired to its own
                Acceptance Criteria.
              </p>
              <div className="space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={f}
                      onChange={(e) => {
                        const next = [...features];
                        next[i] = e.target.value;
                        setFeatures(next);
                      }}
                      placeholder={
                        i === 0
                          ? "Auth + multi-tenant workspaces"
                          : "Another feature"
                      }
                      className="flex-1 bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
                      data-testid={`wizard-feature-${i}`}
                    />
                    {features.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFeatures(features.filter((_, idx) => idx !== i))
                        }
                        className="cf-btn border border-cf-line px-2 hover:bg-cf-elev text-cf-dim hover:text-red-400"
                        data-testid={`wizard-remove-feature-${i}`}
                        aria-label="Remove"
                      >
                        <Minus size={12} weight="bold" />
                      </button>
                    )}
                  </div>
                ))}
                {features.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setFeatures([...features, ""])}
                    className="cf-btn border border-cf-line border-dashed w-full py-2 text-xs text-cf-dim hover:bg-cf-elev hover:text-cf-text transition-colors flex items-center justify-center gap-1"
                    data-testid="wizard-add-feature"
                  >
                    <Plus size={12} weight="bold" /> ADD FEATURE
                  </button>
                )}
              </div>
            </section>
          )}

          {step === 4 && (
            <section data-testid="step-team">
              <div className="overline mb-2">▸ STEP 5 · TEAM & AI</div>
              <h1 className="font-display font-black text-4xl tracking-tighter mb-6">
                How do you work?
              </h1>
              <div className="mb-6">
                <span className="overline">TEAM SIZE</span>
                <div className="mt-2">
                  <Radio
                    options={TEAM}
                    value={teamSize}
                    onChange={setTeamSize}
                    dataPrefix="wizard-team"
                  />
                </div>
              </div>
              <div>
                <span className="overline">AI TOOLS YOU USE</span>
                <div className="mt-2">
                  <ChipGroup
                    options={AI_TOOLS}
                    value={aiTools}
                    onChange={setAiTools}
                    dataPrefix="wizard-aitools"
                  />
                </div>
              </div>
            </section>
          )}

          {step === 5 && (
            <section data-testid="step-deploy">
              <div className="overline mb-2">▸ STEP 6 · DEPLOY</div>
              <h1 className="font-display font-black text-4xl tracking-tighter mb-6">
                Where will it ship?
              </h1>
              <Radio
                options={DEPLOY}
                value={deployment}
                onChange={setDeployment}
                dataPrefix="wizard-deploy"
              />
            </section>
          )}

          {/* nav buttons */}
          <div className="flex items-center gap-2 mt-10 pt-6 border-t border-cf-line">
            <button
              type="button"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="cf-btn border border-cf-line px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-cf-elev transition-colors disabled:opacity-30"
              data-testid="wizard-back-step"
            >
              <ArrowLeft size={11} className="inline mr-1" /> BACK
            </button>
            <div className="text-[10px] text-cf-mute ml-2">
              {step + 1} / {STEPS.length}
            </div>
            <div className="ml-auto" />
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
                disabled={!canNext()}
                className="cf-btn bg-cf-text text-cf-bg px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-30"
                data-testid="wizard-next"
              >
                NEXT <ArrowRight size={11} className="inline ml-1" weight="bold" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting || name.trim().length === 0}
                className="cf-btn bg-cf-text text-cf-bg px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-30 flex items-center gap-1"
                data-testid="wizard-submit"
              >
                <Sparkle size={11} weight="fill" />
                {submitting ? "SEEDING..." : "GENERATE CANVAS"}
              </button>
            )}
          </div>
        </div>

        {/* preview column */}
        <aside className="lg:col-span-4 lg:sticky lg:top-10 lg:self-start">
          <div className="border border-cf-line bg-cf-surface p-4">
            <div className="overline mb-3">▸ STARTER GRAPH PREVIEW</div>
            <div className="text-xs text-cf-mute mb-3">
              We'll seed{" "}
              <span className="text-cf-text font-bold">
                {previewNodes.length} nodes
              </span>{" "}
              wired with typed edges.
            </div>
            <ul className="space-y-1" data-testid="wizard-preview-list">
              {previewNodes.map((n, i) => (
                <li
                  key={i}
                  className="text-[11px] text-cf-text bg-cf-bg border border-cf-line px-2 py-1.5 truncate"
                >
                  · {n}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
