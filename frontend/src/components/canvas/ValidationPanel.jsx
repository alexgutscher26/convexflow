import { Warning, WarningCircle, Info, CheckCircle, X } from "@phosphor-icons/react";
import { NODE_TYPE_MAP } from "@/lib/nodeTypes";

const SEV = {
  error: { color: "#F87171", bg: "rgba(239,68,68,0.08)", icon: WarningCircle, label: "ERROR" },
  warning: { color: "#FBBF24", bg: "rgba(251,191,36,0.08)", icon: Warning, label: "WARN" },
  info: { color: "#60A5FA", bg: "rgba(96,165,250,0.06)", icon: Info, label: "INFO" },
};

export default function ValidationPanel({
  validation,
  loading,
  nodes,
  selectedNodeId,
  onClose,
  onFocusNode,
  onRevalidate,
}) {
  const issues = validation?.issues || [];
  const summary = validation?.summary || {
    error_count: 0,
    warning_count: 0,
    info_count: 0,
    total: 0,
    ready_for_prompt: true,
  };
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <aside
      className="w-80 border-l border-cf-line bg-cf-surface h-full flex flex-col z-10"
      data-testid="validation-panel"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cf-line">
        <Warning size={14} weight="bold" className="text-amber-400" />
        <span className="text-[10px] uppercase tracking-widest font-bold">
          GRAPH VALIDATION
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-cf-mute hover:text-cf-text"
          aria-label="Close"
          data-testid="validation-close"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-0 border-b border-cf-line">
        {[
          { l: "ERR", v: summary.error_count, c: SEV.error.color },
          { l: "WARN", v: summary.warning_count, c: SEV.warning.color },
          { l: "INFO", v: summary.info_count, c: SEV.info.color },
        ].map((s, i) => (
          <div
            key={s.l}
            className={`text-center px-2 py-3 ${i > 0 ? "border-l border-cf-line" : ""}`}
            data-testid={`validation-${s.l.toLowerCase()}-count`}
          >
            <div
              className="font-display font-black text-2xl"
              style={{ color: s.c }}
            >
              {s.v}
            </div>
            <div className="overline mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 flex items-center gap-2 border-b border-cf-line">
        {summary.ready_for_prompt ? (
          <>
            <CheckCircle
              size={12}
              weight="fill"
              className="text-emerald-400"
            />
            <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">
              READY FOR PROMPT GENERATION
            </span>
          </>
        ) : (
          <>
            <WarningCircle size={12} weight="fill" className="text-red-400" />
            <span className="text-[10px] text-red-400 uppercase tracking-widest font-bold">
              FIX ERRORS BEFORE GENERATING
            </span>
          </>
        )}
        <button
          onClick={onRevalidate}
          disabled={loading}
          className="cf-btn ml-auto text-[10px] uppercase tracking-widest text-cf-dim hover:text-cf-text border border-cf-line px-2 py-0.5 hover:bg-cf-elev transition-colors disabled:opacity-50"
          data-testid="revalidate-button"
        >
          {loading ? "..." : "REVALIDATE"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 && !loading && (
          <div className="px-4 py-8 text-center">
            <CheckCircle
              size={32}
              weight="duotone"
              className="mx-auto text-emerald-400"
            />
            <p className="text-xs mt-3 font-bold text-cf-text">No issues</p>
            <p className="text-[11px] text-cf-mute mt-1">
              The graph is consistent and ready to prompt.
            </p>
          </div>
        )}
        {issues.map((issue, i) => {
          const sev = SEV[issue.severity];
          const Icon = sev.icon;
          const node = issue.node_id ? nodeById[issue.node_id] : null;
          const cfg = node
            ? NODE_TYPE_MAP[node.type] || NODE_TYPE_MAP["Product Overview"]
            : null;
          const isSelected = issue.node_id === selectedNodeId;
          return (
            <button
              key={i}
              onClick={() => issue.node_id && onFocusNode(issue.node_id)}
              className={`w-full text-left border-b border-cf-line px-3 py-2.5 hover:bg-cf-elev transition-colors ${
                isSelected ? "bg-cf-elev" : ""
              }`}
              style={{ background: isSelected ? undefined : sev.bg }}
              data-testid={`validation-issue-${issue.code}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={12} weight="bold" style={{ color: sev.color }} />
                <span
                  className="text-[9px] uppercase tracking-widest font-bold"
                  style={{ color: sev.color }}
                >
                  {sev.label}
                </span>
                {cfg && (
                  <span
                    className="ml-auto text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5"
                    style={{ background: cfg.bg, color: cfg.text }}
                  >
                    {cfg.short}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-cf-text leading-snug">
                {issue.message}
              </div>
              <div className="text-[10px] text-cf-mute mt-1 leading-snug">
                → {issue.suggestion}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
