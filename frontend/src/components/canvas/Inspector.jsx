import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
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
  const saveTimer = useRef(null);
  const pendingPatch = useRef({});
  const runAIRef = useRef(null);

  useEffect(() => {
    setDraft(node || null);
    pendingPatch.current = {};
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, [node?.id]);

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
      toast.error(e.response?.data?.detail || "AI request failed");
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
        className="flex items-center gap-2 px-3 py-2"
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

      <div className="px-4 py-3 border-b border-cf-line">
        <span className="overline">TITLE</span>
        <input
          value={current.title || ""}
          onChange={(e) => persist({ title: e.target.value })}
          className="mt-1 w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[13px] font-bold focus:outline-none focus:border-cf-text"
          data-testid="inspector-title"
        />
      </div>

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
            <ReactMarkdown>{current.content || "_(empty)_"}</ReactMarkdown>
          </div>
        )}
      </div>

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
            {(current.file_references || []).map((p) => (
              <li
                key={p}
                className="flex items-center gap-2 text-[11px] bg-cf-bg border border-cf-line px-2 py-1"
              >
                <span className="truncate flex-1" title={p}>{p}</span>
                <button
                  onClick={() => removeFileRef(p)}
                  className="text-cf-mute hover:text-red-400"
                  aria-label="Detach file"
                  data-testid={`detach-file`}
                >
                  <X size={10} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto px-4 py-3 border-t border-cf-line">
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
