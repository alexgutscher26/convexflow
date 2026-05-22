import { useEffect, useRef, useState } from "react";
import SafeMarkdown from "@/components/ui/SafeMarkdown";
import { toast } from "sonner";
import {
  Trash,
  Sparkle,
  CaretDown,
  Eye,
  PencilSimple,
  X,
} from "@phosphor-icons/react";
import { NODE_TYPE_MAP } from "@/lib/nodeTypes";
import { api } from "@/lib/api";

const AI_ACTIONS = [
  { key: "expand", label: "Expand content" },
  { key: "acceptance_criteria", label: "Acceptance criteria" },
  { key: "implementation_plan", label: "Implementation plan" },
  { key: "missing_constraints", label: "Detect missing constraints" },
  { key: "api_schema", label: "Suggest API schema" },
  { key: "test_plan", label: "Generate test plan" },
];

export default function Inspector({ node, onChange, onDelete, onClose, aiAssistRef }) {
  const [draft, setDraft] = useState(node || null);
  const [mode, setMode] = useState("edit"); // edit | preview
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [suggestions, setSuggestions] = useState({ nodes: [], files: [] });
  const [sugLoading, setSugLoading] = useState(false);
  const saveTimer = useRef(null);
  const pendingPatch = useRef({});
  const runAIRef = useRef(null);

  const [constraints, setConstraints] = useState([]);
  const [constraintsLoading, setConstraintsLoading] = useState(false);

  const nodeId = node?.id;
  const nodeType = node?.type;
  const projectId = node?.project_id;

  useEffect(() => {
    if (!nodeId || nodeType !== "AI Coding Rules") {
      return;
    }
    let active = true;
    const fetchConstraints = async () => {
      setConstraintsLoading(true);
      try {
        const { data } = await api.get("/constraints");
        if (active) {
          setConstraints(data);
        }
      } catch (e) {
        console.warn("Failed to fetch constraints:", e);
      } finally {
        if (active) setConstraintsLoading(false);
      }
    };

    fetchConstraints();

    const handleUpdate = () => {
      fetchConstraints();
    };
    window.addEventListener("cf-constraints-updated", handleUpdate);

    return () => {
      active = false;
      window.removeEventListener("cf-constraints-updated", handleUpdate);
    };
  }, [nodeId, nodeType]);

  const handleQuickApply = (text) => {
    const currentContent = current.content || "";
    const prefix = currentContent.length > 0 ? (currentContent.endsWith("\n") ? "" : "\n") : "";
    const formattedConstraint = text.trim().startsWith("-")
      ? text.trim()
      : `- ${text.trim()}`;
    const newContent = `${currentContent}${prefix}${formattedConstraint}`;
    persist({ content: newContent });
    toast.success("Applied constraint!");
  };

  useEffect(() => {
    setDraft(node || null);
    pendingPatch.current = {};
    if (saveTimer.current) clearTimeout(saveTimer.current);

    if (!nodeId || ["GitHub Context", "Prompt Output"].includes(nodeType)) {
      setSuggestions({ nodes: [], files: [] });
      return;
    }

    let active = true;
    const fetchSuggestions = async () => {
      setSugLoading(true);
      try {
        const { data } = await api.get(
          `/projects/${projectId}/semantic-suggest?node_id=${nodeId}&limit=3`
        );
        if (active) {
          setSuggestions(data);
        }
      } catch (e) {
        console.warn("Failed to fetch semantic suggestions:", e);
      } finally {
        if (active) setSugLoading(false);
      }
    };

    fetchSuggestions();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, nodeType, projectId]);

  useEffect(() => {
    if (aiAssistRef) {
      aiAssistRef.current = () => runAIRef.current?.("expand");
    }
    return () => {
      if (aiAssistRef) aiAssistRef.current = null;
    };
  }, [aiAssistRef]);

  if (!node) {
    return (
      <aside
        className="w-80 border-l border-cf-line bg-cf-surface h-full flex flex-col z-10 items-center justify-center text-center p-6"
        data-testid="inspector-empty"
      >
        <div className="overline mb-3">▸ INSPECTOR</div>
        <p className="text-xs text-cf-mute leading-relaxed max-w-[200px]">
          Select a node to edit its content, attach files, or invoke AI.
        </p>
      </aside>
    );
  }

  // Always read from a guaranteed-defined value
  const current = draft && draft.id === node.id ? draft : node;
  const cfg = NODE_TYPE_MAP[current.type] || NODE_TYPE_MAP["Product Overview"];
  const Icon = cfg.icon;

  const persist = (patch) => {
    const merged = { ...current, ...patch };
    setDraft(merged);
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSend = pendingPatch.current;
      pendingPatch.current = {};
      onChange(node.id, toSend);
    }, 350);
  };

  const removeFileRef = (path) => {
    const next = (current.file_references || []).filter((p) => p !== path);
    persist({ file_references: next });
  };

  const runSinglePromptNode = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post(`/nodes/${node.id}/execute-prompt`);
      onChange(node.id, {
        content: data.content,
        metadata: data.metadata,
      });
      setDraft(data);
      toast.success("Prompt executed successfully");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Execution failed");
    } finally {
      setAiLoading(false);
    }
  };

  const runAI = async (action) => {
    setAiLoading(true);
    setAiOpen(false);
    try {
      const { data } = await api.post("/ai/expand", {
        node_id: node.id,
        instruction: action,
      });
      const newContent =
        action === "expand"
          ? data.content
          : (current.content || "") + "\n\n" + data.content;
      persist({ content: newContent });
      toast.success("AI updated content");
    } catch (e) {
      const status = e.response?.status;
      const detail = e.response?.data?.detail || "AI request failed";
      if (status === 402) {
        toast.error(detail, {
          duration: 12000,
          description: "Profile → Universal Key → Add Balance",
        });
      } else {
        toast.error(detail);
      }
    } finally {
      setAiLoading(false);
    }
  };
  runAIRef.current = runAI;

  return (
    <aside
      className="w-80 border-l border-cf-line bg-cf-surface h-full flex flex-col z-10"
      data-testid="inspector-panel"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ background: cfg.bg, color: cfg.text }}
      >
        <Icon size={14} weight="bold" />
        <span className="text-[10px] uppercase tracking-widest font-bold">
          {cfg.short}
        </span>
        <span className="text-[10px] ml-auto opacity-80">{cfg.type}</span>
        <button
          onClick={onClose}
          className="hover:opacity-80"
          aria-label="Close"
          data-testid="inspector-close"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 py-3 border-b border-cf-line">
          <span className="overline">TITLE</span>
          <input
            value={current.title || ""}
            onChange={(e) => persist({ title: e.target.value })}
            className="mt-1 w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[13px] font-bold focus:outline-none focus:border-cf-text"
            data-testid="inspector-title"
          />
        </div>

        {current.type === "Prompt Output" ? (
          <>
            <div className="px-4 py-3 border-b border-cf-line bg-zinc-950/20">
              <span className="overline text-[10px] text-emerald-400 tracking-wider mb-2 block flex items-center gap-1.5">
                <Sparkle size={12} weight="fill" />
                PROMPT / INSTRUCTION
              </span>
              <textarea
                value={current.metadata?.prompt || current.content || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  persist({
                    metadata: {
                      ...(current.metadata || {}),
                      prompt: val
                    }
                  });
                }}
                rows={6}
                placeholder="e.g. Generate a MongoDB schema for a SaaS billing system..."
                className="w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text resize-y font-mono"
                data-testid="inspector-prompt-instruction"
              />
            </div>

            <div className="px-4 py-3 border-b border-cf-line">
              <div className="flex items-center justify-between mb-2">
                <span className="overline">GENERATED OUTPUT</span>
                <div className="flex border border-cf-line">
                  <button
                    onClick={() => setMode("edit")}
                    className={`px-2 py-0.5 text-[9px] uppercase tracking-widest ${
                      mode === "edit" ? "bg-cf-elev text-cf-text" : "text-cf-dim"
                    }`}
                    data-testid="inspector-mode-edit"
                  >
                    <PencilSimple size={10} className="inline mr-1" />
                    EDIT
                  </button>
                  <button
                    onClick={() => setMode("preview")}
                    className={`px-2 py-0.5 text-[9px] uppercase tracking-widest border-l border-cf-line ${
                      mode === "preview" ? "bg-cf-elev text-cf-text" : "text-cf-dim"
                    }`}
                    data-testid="inspector-mode-preview"
                  >
                    <Eye size={10} className="inline mr-1" />
                    PREVIEW
                  </button>
                </div>
              </div>
              {mode === "edit" ? (
                <textarea
                  value={current.content || ""}
                  onChange={(e) => persist({ content: e.target.value })}
                  rows={8}
                  placeholder="No output generated yet. Edit prompt above and click 'RUN NODE' to execute."
                  className="w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text resize-y font-mono"
                  data-testid="inspector-content"
                />
              ) : (
                <div className="bg-cf-bg border border-cf-line p-3 cf-prose max-h-64 overflow-y-auto">
                  <SafeMarkdown>{current.content || "_(empty)_"}</SafeMarkdown>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-b border-cf-line">
              <button
                onClick={runSinglePromptNode}
                disabled={aiLoading}
                className="cf-btn w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 text-[11px] uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:shadow-[0_0_16px_rgba(16,185,129,0.3)] duration-200"
                data-testid="inspector-run-node"
              >
                <Sparkle size={12} weight={aiLoading ? "regular" : "fill"} className={aiLoading ? "animate-spin" : ""} />
                {aiLoading ? "GENERATING OUTPUT..." : "RUN NODE"}
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-3 border-b border-cf-line">
            <div className="flex items-center justify-between mb-2">
              <span className="overline">CONTENT (MARKDOWN)</span>
              <div className="flex border border-cf-line">
                <button
                  onClick={() => setMode("edit")}
                  className={`px-2 py-0.5 text-[9px] uppercase tracking-widest ${
                    mode === "edit" ? "bg-cf-elev text-cf-text" : "text-cf-dim"
                  }`}
                  data-testid="inspector-mode-edit"
                >
                  <PencilSimple size={10} className="inline mr-1" />
                  EDIT
                </button>
                <button
                  onClick={() => setMode("preview")}
                  className={`px-2 py-0.5 text-[9px] uppercase tracking-widest border-l border-cf-line ${
                    mode === "preview" ? "bg-cf-elev text-cf-text" : "text-cf-dim"
                  }`}
                  data-testid="inspector-mode-preview"
                >
                  <Eye size={10} className="inline mr-1" />
                  PREVIEW
                </button>
              </div>
            </div>
            {mode === "edit" ? (
              <textarea
                value={current.content || ""}
                onChange={(e) => persist({ content: e.target.value })}
                rows={10}
                placeholder={cfg.template}
                className="w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text resize-y font-mono"
                data-testid="inspector-content"
              />
            ) : (
              <div className="bg-cf-bg border border-cf-line p-3 cf-prose max-h-96 overflow-y-auto">
                <SafeMarkdown>{current.content || "_(empty)_"}</SafeMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Quick Apply Rules Section */}
        {current.type === "AI Coding Rules" && (
          <div className="px-4 py-3 border-b border-cf-line flex flex-col min-h-[220px]">
            <span className="overline mb-2 block text-emerald-400 font-bold tracking-wider">
              QUICK APPLY RULES
            </span>
            {constraintsLoading ? (
              <p className="text-[11px] text-cf-mute animate-pulse">Loading library...</p>
            ) : constraints.length === 0 ? (
              <p className="text-[11px] text-cf-mute">
                No constraints in library. Add rules in the LIBRARY tab.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1" data-testid="inspector-quick-apply-list">
                {constraints.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleQuickApply(c.text)}
                    className="w-full text-left text-[11px] p-2 border border-cf-line hover:border-cf-line2 bg-cf-bg/40 hover:bg-cf-elev text-cf-text transition-colors flex items-start justify-between group relative"
                    style={{ borderRadius: "2px" }}
                    title="Click to append to content"
                    data-testid={`quick-apply-${c.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[8px] uppercase tracking-widest text-cf-mute font-bold mb-0.5">
                        {c.category}
                      </div>
                      <p className="break-words leading-relaxed select-none">{c.text}</p>
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-cf-mute ml-2 shrink-0 bg-cf-elev px-1.5 py-0.5 border border-cf-line group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                      + APPLY
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3 border-b border-cf-line relative">
          <button
            onClick={() => setAiOpen((v) => !v)}
            disabled={aiLoading}
            className="cf-btn w-full bg-cf-text text-cf-bg py-2 text-[11px] font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="inspector-ai-button"
          >
            <Sparkle size={12} weight="fill" />
            {aiLoading ? "THINKING..." : "AI ASSIST"}
            <CaretDown size={10} weight="bold" />
            <kbd className="ml-2 border border-cf-bg/30 px-1 text-[9px] opacity-60">⌘.</kbd>
          </button>
          {aiOpen && (
            <div className="absolute left-4 right-4 mt-1 border border-cf-line bg-cf-bg z-20">
              {AI_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => runAI(a.key)}
                  className="w-full px-3 py-2 text-[11px] text-left hover:bg-cf-elev text-cf-dim hover:text-cf-text border-b border-cf-line last:border-b-0 transition-colors"
                  data-testid={`ai-action-${a.key}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-b border-cf-line">
          <span className="overline mb-2 block">LINKED FILES</span>
          {(current.file_references || []).length === 0 ? (
            <p className="text-[11px] text-cf-mute">
              Open the REPO tab in the sidebar and click files to attach.
            </p>
          ) : (
            <ul className="space-y-1">
              {(current.file_references || []).map((p) => {
                const stale = (
                  current.metadata?.stale_file_references || []
                ).includes(p);
                return (
                  <li
                    key={p}
                    className="flex items-center gap-2 text-[11px] bg-cf-bg border px-2 py-1"
                    style={{
                      borderColor: stale ? "#FB923C" : undefined,
                      background: stale ? "rgba(251,146,60,0.08)" : undefined,
                    }}
                    data-testid={stale ? "linked-file-stale" : "linked-file"}
                  >
                    <span
                      className="truncate flex-1"
                      title={
                        stale
                          ? `${p} — file missing in latest scan`
                          : p
                      }
                      style={{
                        textDecoration: stale ? "line-through" : undefined,
                        color: stale ? "#FB923C" : undefined,
                      }}
                    >
                      {p}
                    </span>
                    {stale && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1 py-0.5"
                        style={{ background: "#FB923C", color: "#0A0A0B" }}
                      >
                        STALE
                      </span>
                    )}
                    <button
                      onClick={() => removeFileRef(p)}
                      className="text-cf-mute hover:text-red-400"
                      aria-label="Detach file"
                      data-testid={`detach-file`}
                    >
                      <X size={10} weight="bold" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Semantic Recommendations Section */}
        {!["GitHub Context", "Prompt Output"].includes(current.type) && (
          <div className="px-4 py-3 border-b border-cf-line bg-cf-bg/15">
            <span className="overline mb-2 block flex items-center gap-1.5 text-emerald-400 font-bold tracking-wider">
              <Sparkle size={12} weight="fill" />
              SEMANTIC SUGGESTIONS
            </span>
            {sugLoading ? (
              <p className="text-[11px] text-cf-mute animate-pulse">Computing matches...</p>
            ) : (!suggestions?.nodes?.length && !suggestions?.files?.length) ? (
              <p className="text-[11px] text-cf-mute leading-relaxed">
                No strong relationships detected yet. Build your semantic index in the REPO tab.
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.nodes && suggestions.nodes.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-cf-mute mb-1 font-bold">
                      Related Nodes
                    </div>
                    <ul className="space-y-1">
                      {suggestions.nodes.map((n) => (
                        <li
                          key={n.id}
                          className="text-[11px] text-cf-dim hover:text-cf-text transition-colors flex items-center justify-between py-0.5"
                        >
                          <span className="truncate flex-1" title={n.title}>
                            {n.title}
                          </span>
                          <span className="text-[9px] text-cf-mute ml-2 shrink-0 bg-cf-elev px-1 rounded font-mono">
                            {Math.round(n.similarity * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {suggestions.files && suggestions.files.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-cf-mute mb-1 font-bold">
                      Suggested Code Files
                    </div>
                    <ul className="space-y-1">
                      {suggestions.files.map((f) => {
                        const alreadyAttached = (current.file_references || []).includes(f.path);
                        return (
                          <li
                            key={f.path}
                            className="flex items-center justify-between text-[11px] bg-cf-bg/40 border border-cf-line/40 px-2 py-1"
                          >
                            <span
                              className="truncate flex-1 text-cf-dim cursor-help"
                              title={f.path}
                            >
                              {f.path.split("/").pop()}
                            </span>
                            <span className="text-[9px] text-cf-mute mx-2 shrink-0 font-mono">
                              {Math.round(f.similarity * 100)}%
                            </span>
                            {alreadyAttached ? (
                              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                                Attached
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  const next = [...(current.file_references || [])];
                                  if (!next.includes(f.path)) {
                                    next.push(f.path);
                                    persist({ file_references: next });
                                    toast.success(`Attached ${f.path.split("/").pop()}`);
                                  }
                                }}
                                className="text-[9px] text-cf-text hover:text-emerald-400 font-bold uppercase tracking-wider"
                              >
                                Attach
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto px-4 py-3 border-t border-cf-line shrink-0 bg-cf-surface">
        <button
          onClick={() => onDelete(node.id)}
          className="cf-btn w-full border border-red-900 text-red-400 py-2 text-[11px] font-bold hover:bg-red-950 transition-colors flex items-center justify-center gap-2"
          data-testid="inspector-delete"
        >
          <Trash size={12} weight="bold" /> DELETE NODE
        </button>
      </div>
    </aside>
  );
}
