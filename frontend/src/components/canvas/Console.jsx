import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Sparkle,
  Export,
  CopySimple,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";

const TEMPLATES = [
  { value: "feature_implementation", label: "Feature implementation" },
  { value: "refactor", label: "Refactor" },
  { value: "bug_fix", label: "Bug fix" },
  { value: "testing", label: "Testing" },
  { value: "migration", label: "Migration" },
  { value: "architecture", label: "Architecture planning" },
];

const EXPORTS = [
  { value: "markdown", label: "Markdown PRD" },
  { value: "agent_pack", label: "Agent context pack" },
  { value: "json", label: "JSON graph" },
];

export default function Console({ projectId, selectedNodeIds }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("prompt");
  const [template, setTemplate] = useState("feature_implementation");
  const [extra, setExtra] = useState("");
  const [exportFmt, setExportFmt] = useState("markdown");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setOutput("");
    try {
      const { data } = await api.post(
        `/projects/${projectId}/ai/generate-prompt`,
        {
          template,
          focus_node_ids: selectedNodeIds,
          extra_instructions: extra,
        },
      );
      setOutput(data.prompt);
      toast.success("Prompt generated");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const exportProj = async () => {
    setLoading(true);
    setOutput("");
    try {
      const { data } = await api.post(`/projects/${projectId}/export`, {
        format: exportFmt,
      });
      const content =
        typeof data.content === "string"
          ? data.content
          : JSON.stringify(data.content, null, 2);
      setOutput(content);
      toast.success(`Exported ${data.format}`);
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const download = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = tab === "export"
      ? exportFmt === "json"
        ? "json"
        : "md"
      : "md";
    a.download = `cortexflow-${tab}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className="border-t border-cf-line bg-cf-bg z-20"
      style={{ height: open ? 280 : 36 }}
      data-testid="console-panel"
    >
      <div className="flex items-center border-b border-cf-line">
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-2 text-cf-dim hover:text-cf-text"
          aria-label="Toggle console"
          data-testid="console-toggle"
        >
          {open ? <CaretDown size={12} /> : <CaretUp size={12} />}
        </button>
        <button
          onClick={() => {
            setTab("prompt");
            setOpen(true);
          }}
          className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${
            tab === "prompt"
              ? "bg-cf-elev text-cf-text border-b-2 border-cf-text -mb-px"
              : "text-cf-dim hover:bg-cf-elev"
          }`}
          data-testid="console-tab-prompt"
        >
          <Sparkle size={11} weight="fill" className="inline mr-1.5" />
          PROMPT ENGINE
        </button>
        <button
          onClick={() => {
            setTab("export");
            setOpen(true);
          }}
          className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold border-l border-cf-line transition-colors ${
            tab === "export"
              ? "bg-cf-elev text-cf-text border-b-2 border-cf-text -mb-px"
              : "text-cf-dim hover:bg-cf-elev"
          }`}
          data-testid="console-tab-export"
        >
          <Export size={11} weight="bold" className="inline mr-1.5" />
          EXPORT
        </button>
        <div className="ml-auto flex items-center gap-2 pr-3">
          {output && (
            <>
              <button
                onClick={copy}
                className="text-[10px] uppercase tracking-widest text-cf-dim hover:text-cf-text px-2 py-1"
                data-testid="console-copy"
              >
                <CopySimple size={11} className="inline mr-1" />
                COPY
              </button>
              <button
                onClick={download}
                className="text-[10px] uppercase tracking-widest text-cf-dim hover:text-cf-text px-2 py-1"
                data-testid="console-download"
              >
                DOWNLOAD
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="flex h-[calc(100%-37px)]">
          <div className="w-72 border-r border-cf-line p-3 overflow-y-auto">
            {tab === "prompt" && (
              <>
                <div className="overline mb-2">▸ TEMPLATE</div>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text"
                  data-testid="prompt-template-select"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <div className="overline mt-3 mb-2">
                  ▸ EXTRA INSTRUCTIONS
                </div>
                <textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  rows={4}
                  placeholder="Optional override or extra context..."
                  className="w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[11px] focus:outline-none focus:border-cf-text resize-none"
                  data-testid="prompt-extra"
                />
                <div className="text-[10px] text-cf-mute mt-2">
                  Focus:{" "}
                  {selectedNodeIds.length > 0
                    ? `${selectedNodeIds.length} selected node(s)`
                    : "all nodes"}
                </div>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="cf-btn w-full bg-cf-text text-cf-bg py-2 text-[11px] font-bold mt-3 hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="generate-prompt-button"
                >
                  <Sparkle size={11} weight="fill" />
                  {loading ? "GENERATING..." : "GENERATE PROMPT"}
                </button>
              </>
            )}
            {tab === "export" && (
              <>
                <div className="overline mb-2">▸ FORMAT</div>
                <select
                  value={exportFmt}
                  onChange={(e) => setExportFmt(e.target.value)}
                  className="w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text"
                  data-testid="export-format-select"
                >
                  {EXPORTS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-cf-mute mt-3 leading-relaxed">
                  Markdown is best for human PRDs. Agent pack is preformatted
                  for Cursor / Copilot. JSON preserves the full graph.
                </p>
                <button
                  onClick={() => exportProj()}
                  disabled={loading}
                  className="cf-btn w-full bg-cf-text text-cf-bg py-2 text-[11px] font-bold mt-3 hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="export-button"
                >
                  <Export size={11} weight="bold" />
                  {loading ? "EXPORTING..." : "GENERATE EXPORT"}
                </button>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  <button
                    onClick={() => { setExportFmt("markdown"); exportProj("markdown"); }}
                    disabled={loading}
                    className="cf-btn border border-cf-line py-1.5 text-[9px] uppercase tracking-widest font-bold hover:bg-cf-elev transition-colors disabled:opacity-50"
                    data-testid="export-markdown-button"
                  >
                    .MD
                  </button>
                  <button
                    onClick={() => { setExportFmt("json"); exportProj("json"); }}
                    disabled={loading}
                    className="cf-btn border border-cf-line py-1.5 text-[9px] uppercase tracking-widest font-bold hover:bg-cf-elev transition-colors disabled:opacity-50"
                    data-testid="export-json-button"
                  >
                    .JSON
                  </button>
                  <button
                    onClick={() => { setExportFmt("agent_pack"); exportProj("agent_pack"); }}
                    disabled={loading}
                    className="cf-btn border border-cf-line py-1.5 text-[9px] uppercase tracking-widest font-bold hover:bg-cf-elev transition-colors disabled:opacity-50"
                    data-testid="export-agent-pack-button"
                  >
                    AGENT
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto bg-cf-bg" data-testid="export-output">
            {!output && !loading && (
              <div className="p-6 text-[11px] text-cf-mute" data-testid="prompt-output-placeholder">
                ▸ Output will appear here.
              </div>
            )}
            {loading && (
              <div className="p-6 text-[11px] text-cf-dim overline">
                ▸ {tab === "prompt" ? "COMPOSING PROMPT" : "BUILDING EXPORT"}...
              </div>
            )}
            {output && (
              <div className="p-4 cf-prose" data-testid="prompt-output">
                <ReactMarkdown>{output}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
