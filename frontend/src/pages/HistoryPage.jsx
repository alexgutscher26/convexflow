import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SafeMarkdown from "@/components/ui/SafeMarkdown";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Sparkle,
  Export,
  CaretRight,
  Trash,
  GitDiff,
  X,
  ArrowsHorizontal,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { NODE_TYPE_MAP, EDGE_REL_MAP } from "@/lib/nodeTypes";
import { lineDiff, diffStats } from "@/lib/diff";

const KIND_META = {
  manual: { label: "MANUAL", color: "#FAFAFA", icon: Camera },
  prompt: { label: "PROMPT", color: "#06B6D4", icon: Sparkle },
  export: { label: "EXPORT", color: "#F59E0B", icon: Export },
};

function KindBadge({ kind }) {
  const m = KIND_META[kind] || KIND_META.manual;
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold border"
      style={{ color: m.color, borderColor: m.color }}
    >
      <Icon size={9} weight="bold" /> {m.label}
    </span>
  );
}

function NodePill({ node }) {
  const cfg = NODE_TYPE_MAP[node.type] || NODE_TYPE_MAP["Product Overview"];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="uppercase tracking-widest">{cfg.short}</span>
      <span className="font-normal opacity-80 truncate max-w-[160px]">
        {node.title || "(untitled)"}
      </span>
    </span>
  );
}

function FileDiff({ before, after }) {
  const diff = useMemo(() => lineDiff(before, after), [before, after]);
  const stats = diffStats(diff);
  if (stats.add === 0 && stats.del === 0) {
    return (
      <div className="text-[10px] text-cf-mute px-3 py-2">
        (no textual change)
      </div>
    );
  }
  return (
    <div>
      <div className="px-3 py-1 border-b border-cf-line flex items-center justify-between bg-cf-bg">
        <span className="overline">▸ TEXT DIFF</span>
        <span className="text-[10px] font-bold">
          <span className="text-emerald-400">+{stats.add}</span>
          {" · "}
          <span className="text-red-400">-{stats.del}</span>
        </span>
      </div>
      <pre className="bg-cf-bg text-[11px] font-mono leading-snug overflow-x-auto px-0 py-1 m-0">
        {diff.map((d, i) => {
          const bg =
            d.type === "add"
              ? "rgba(16,185,129,0.12)"
              : d.type === "del"
                ? "rgba(239,68,68,0.12)"
                : "transparent";
          const prefix = d.type === "add" ? "+" : d.type === "del" ? "-" : " ";
          const color =
            d.type === "add"
              ? "#34D399"
              : d.type === "del"
                ? "#F87171"
                : "#71717a";
          return (
            <div
              key={i}
              style={{ background: bg }}
              className="px-3 whitespace-pre-wrap break-words"
            >
              <span style={{ color, marginRight: 8 }}>{prefix}</span>
              <span
                style={{
                  color:
                    d.type === "eq"
                      ? "#a1a1aa"
                      : d.type === "add"
                        ? "#d4f3df"
                        : "#fecaca",
                }}
              >
                {d.line || " "}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function SnapshotList({ snapshots, onOpen, onCompare, onDelete, compareSet }) {
  if (!snapshots.length) {
    return (
      <div className="border border-cf-line bg-cf-surface p-12 text-center">
        <Camera size={40} weight="duotone" className="mx-auto text-cf-mute" />
        <h3 className="font-display font-bold text-xl mt-4 tracking-tight">
          No snapshots yet
        </h3>
        <p className="text-xs text-cf-dim mt-2 max-w-md mx-auto">
          Snapshots are created automatically when you generate a prompt or
          export, and you can take manual checkpoints any time from the canvas.
        </p>
      </div>
    );
  }
  return (
    <div>
      {snapshots.map((s) => {
        const inCompare = compareSet.has(s.id);
        return (
          <div
            key={s.id}
            className={`border border-cf-line -mt-px flex items-center gap-3 px-4 py-3 hover:bg-cf-surface transition-colors ${
              inCompare ? "bg-cf-surface" : ""
            }`}
            data-testid={`snapshot-row-${s.id}`}
          >
            <button
              onClick={() => onCompare(s.id)}
              className={`w-4 h-4 border border-cf-line2 ${
                inCompare ? "bg-cf-text" : ""
              }`}
              aria-label="Select for compare"
              data-testid={`compare-checkbox-${s.id}`}
              title={
                inCompare ? "Click to deselect" : "Click to mark for compare"
              }
            />
            <KindBadge kind={s.kind} />
            <button
              onClick={() => onOpen(s.id)}
              className="flex-1 text-left min-w-0"
              data-testid={`open-snapshot-${s.id}`}
            >
              <div className="text-sm font-bold text-cf-text truncate">
                {s.label}
              </div>
              <div className="text-[10px] text-cf-mute mt-0.5 flex items-center gap-3">
                <span>{new Date(s.created_at).toLocaleString()}</span>
                <span>·</span>
                <span>{s.nodes_count} NODES</span>
                <span>·</span>
                <span>{s.edges_count} EDGES</span>
              </div>
            </button>
            <CaretRight
              size={12}
              className="text-cf-mute cursor-pointer"
              onClick={() => onOpen(s.id)}
            />
            <button
              onClick={() => onDelete(s.id)}
              className="text-cf-mute hover:text-red-400"
              aria-label="Delete"
              data-testid={`delete-snapshot-${s.id}`}
            >
              <Trash size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SnapshotDetail({ snapshot, onBack }) {
  const meta = snapshot.metadata || {};
  return (
    <div data-testid="snapshot-detail">
      <button
        onClick={onBack}
        className="text-cf-dim hover:text-cf-text text-xs flex items-center gap-2 mb-4"
        data-testid="snapshot-detail-back"
      >
        <ArrowLeft size={12} /> BACK TO HISTORY
      </button>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <KindBadge kind={snapshot.kind} />
        <span className="text-[10px] text-cf-mute uppercase tracking-widest">
          {new Date(snapshot.created_at).toLocaleString()}
        </span>
      </div>
      <h1 className="font-display font-black text-3xl tracking-tighter break-words">
        {snapshot.label}
      </h1>
      <div className="text-xs text-cf-dim mt-2">
        {snapshot.nodes_data?.length || 0} nodes · {snapshot.edges_data?.length || 0} edges
      </div>

      {meta.prompt_text && (
        <div className="mt-8 border border-cf-line">
          <div className="px-4 py-2 border-b border-cf-line bg-cf-surface flex items-center justify-between">
            <span className="overline">▸ GENERATED PROMPT</span>
            <span className="text-[10px] text-cf-mute uppercase tracking-widest">
              template: {meta.prompt_template || "—"}
            </span>
          </div>
          <div className="p-4 cf-prose max-h-[60vh] overflow-y-auto">
            <SafeMarkdown>{meta.prompt_text}</SafeMarkdown>
          </div>
        </div>
      )}

      {meta.export_format && (
        <div className="mt-8 border border-cf-line">
          <div className="px-4 py-2 border-b border-cf-line bg-cf-surface flex items-center justify-between">
            <span className="overline">▸ EXPORT · {meta.export_format}</span>
          </div>
          <div className="p-4 cf-prose max-h-[60vh] overflow-y-auto">
            {typeof meta.export_content === "string" ? (
              <SafeMarkdown>{meta.export_content}</SafeMarkdown>
            ) : (
              <pre className="text-[11px] whitespace-pre-wrap">
                {JSON.stringify(meta.export_content, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 border border-cf-line">
        <div className="px-4 py-2 border-b border-cf-line bg-cf-surface overline">
          ▸ NODES AT THIS POINT
        </div>
        <div className="p-3 flex flex-wrap gap-1.5">
          {snapshot.nodes_data?.map((n) => (
            <NodePill key={n.id} node={n} />
          ))}
          {!snapshot.nodes_data?.length && (
            <span className="text-xs text-cf-mute">(empty graph)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffView({ diff, onClose }) {
  const d = diff.diff;
  return (
    <div data-testid="diff-view">
      <button
        onClick={onClose}
        className="text-cf-dim hover:text-cf-text text-xs flex items-center gap-2 mb-4"
        data-testid="diff-view-back"
      >
        <ArrowLeft size={12} /> BACK TO HISTORY
      </button>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <GitDiff size={20} weight="bold" />
        <h1 className="font-display font-black text-3xl tracking-tighter">
          Diff
        </h1>
      </div>
      <div className="grid grid-cols-2 gap-0 border border-cf-line mb-6">
        <div className="p-4 border-r border-cf-line">
          <div className="overline mb-1">▸ BEFORE</div>
          <KindBadge kind={diff.before.kind} />
          <div className="font-bold text-sm mt-2 break-words">
            {diff.before.label}
          </div>
          <div className="text-[10px] text-cf-mute mt-1">
            {new Date(diff.before.created_at).toLocaleString()}
          </div>
        </div>
        <div className="p-4 bg-cf-surface">
          <div className="overline mb-1">▸ AFTER</div>
          <KindBadge kind={diff.after.kind} />
          <div className="font-bold text-sm mt-2 break-words">
            {diff.after.label}
          </div>
          <div className="text-[10px] text-cf-mute mt-1">
            {new Date(diff.after.created_at).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-6">
        {[
          { l: "NODES +", v: d.summary.nodes_added, c: "#34D399" },
          { l: "NODES −", v: d.summary.nodes_removed, c: "#F87171" },
          { l: "NODES ~", v: d.summary.nodes_modified, c: "#FBBF24" },
          { l: "EDGES +", v: d.summary.edges_added, c: "#34D399" },
          { l: "EDGES −", v: d.summary.edges_removed, c: "#F87171" },
        ].map((s) => (
          <div
            key={s.l}
            className="border border-cf-line p-3 text-center"
            data-testid={`diff-stat-${s.l}`}
          >
            <div
              className="font-display font-black text-3xl"
              style={{ color: s.c }}
            >
              {s.v}
            </div>
            <div className="overline mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      {d.added_nodes.length > 0 && (
        <section className="mb-6">
          <h2 className="overline mb-2">▸ NODES ADDED ({d.added_nodes.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {d.added_nodes.map((n) => (
              <NodePill key={n.id} node={n} />
            ))}
          </div>
        </section>
      )}
      {d.removed_nodes.length > 0 && (
        <section className="mb-6">
          <h2 className="overline mb-2">▸ NODES REMOVED ({d.removed_nodes.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {d.removed_nodes.map((n) => (
              <NodePill key={n.id} node={n} />
            ))}
          </div>
        </section>
      )}

      {d.modified_nodes.length > 0 && (
        <section className="mb-6">
          <h2 className="overline mb-3">
            ▸ NODES MODIFIED ({d.modified_nodes.length})
          </h2>
          {d.modified_nodes.map((m) => (
            <div
              key={m.id}
              className="border border-cf-line mb-3"
              data-testid={`diff-modified-${m.id}`}
            >
              <div className="flex items-center gap-3 px-3 py-2 border-b border-cf-line bg-cf-surface flex-wrap">
                <NodePill node={{ type: m.type, title: m.title_after }} />
                <span className="text-[10px] text-cf-mute uppercase tracking-widest">
                  {m.changed_fields.join(" · ")}
                </span>
              </div>
              {m.changed_fields.includes("title") && (
                <div className="px-3 py-2 border-b border-cf-line text-[11px]">
                  <span className="text-cf-mute">TITLE: </span>
                  <span className="text-red-400 line-through">
                    {m.title_before || "(empty)"}
                  </span>{" "}
                  <ArrowsHorizontal size={10} className="inline" />{" "}
                  <span className="text-emerald-400">{m.title_after}</span>
                </div>
              )}
              {m.changed_fields.includes("content") && (
                <FileDiff
                  before={m.content_before}
                  after={m.content_after}
                />
              )}
              {m.changed_fields.includes("file_references") && (
                <div className="px-3 py-2 border-t border-cf-line text-[11px]">
                  <div className="overline mb-1">▸ LINKED FILES</div>
                  {m.file_references_before
                    .filter((f) => !m.file_references_after.includes(f))
                    .map((f) => (
                      <div key={f} className="text-red-400">- {f}</div>
                    ))}
                  {m.file_references_after
                    .filter((f) => !m.file_references_before.includes(f))
                    .map((f) => (
                      <div key={f} className="text-emerald-400">+ {f}</div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {d.added_edges.length > 0 && (
        <section className="mb-6">
          <h2 className="overline mb-2">▸ EDGES ADDED ({d.added_edges.length})</h2>
          <ul className="text-[11px] space-y-1">
            {d.added_edges.map((e, i) => {
              const rel = EDGE_REL_MAP[e.relationship_type] || EDGE_REL_MAP.depends_on;
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-emerald-400">+</span>
                  <code className="text-cf-dim">{e.source_node_id.slice(0, 6)}</code>
                  <span style={{ color: rel.color }}>→ {rel.label}</span>
                  <code className="text-cf-dim">{e.target_node_id.slice(0, 6)}</code>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {d.removed_edges.length > 0 && (
        <section className="mb-6">
          <h2 className="overline mb-2">▸ EDGES REMOVED ({d.removed_edges.length})</h2>
          <ul className="text-[11px] space-y-1">
            {d.removed_edges.map((e, i) => {
              const rel = EDGE_REL_MAP[e.relationship_type] || EDGE_REL_MAP.depends_on;
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-red-400">−</span>
                  <code className="text-cf-dim">{e.source_node_id.slice(0, 6)}</code>
                  <span style={{ color: rel.color, opacity: 0.6 }}>
                    → {rel.label}
                  </span>
                  <code className="text-cf-dim">{e.target_node_id.slice(0, 6)}</code>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {d.summary.nodes_added === 0 &&
        d.summary.nodes_removed === 0 &&
        d.summary.nodes_modified === 0 &&
        d.summary.edges_added === 0 &&
        d.summary.edges_removed === 0 && (
          <div className="border border-cf-line p-12 text-center">
            <div className="text-cf-dim">No graph changes between these snapshots.</div>
          </div>
        )}
    </div>
  );
}

export default function HistoryPage() {
  const { id: projectId } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [diff, setDiff] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const compareSet = useMemo(() => new Set(compareIds), [compareIds]);

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/snapshots`),
      ]);
      setProject(p.data);
      setSnapshots(s.data);
    } catch (e) {
      toast.error("Failed to load history");
      nav("/app");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openSnapshot = async (id) => {
    try {
      const { data } = await api.get(`/snapshots/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error("Failed to load snapshot");
    }
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const runDiff = async () => {
    if (compareIds.length !== 2) return;
    // Order: older = before, newer = after.
    const [a, b] = compareIds
      .map((id) => snapshots.find((s) => s.id === id))
      .filter(Boolean);
    if (!a || !b) return;
    const olderFirst =
      new Date(a.created_at) <= new Date(b.created_at) ? [a, b] : [b, a];
    try {
      const { data } = await api.get(
        `/snapshots/${olderFirst[0].id}/diff/${olderFirst[1].id}`,
      );
      setDiff(data);
    } catch (e) {
      toast.error("Diff failed");
    }
  };

  const removeSnapshot = async (id) => {
    if (!window.confirm("Delete this snapshot?")) return;
    try {
      await api.delete(`/snapshots/${id}`);
      setSnapshots((s) => s.filter((x) => x.id !== id));
      setCompareIds((c) => c.filter((x) => x !== id));
      toast.success("Snapshot deleted");
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cf-bg flex items-center justify-center">
        <span className="overline">▸ LOADING HISTORY</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text font-mono">
      <header className="h-12 border-b border-cf-line flex items-center px-4 gap-3">
        <Link
          to={`/app/project/${projectId}`}
          className="text-cf-dim hover:text-cf-text flex items-center gap-2 text-xs"
          data-testid="history-back-canvas"
        >
          <ArrowLeft size={14} /> CANVAS
        </Link>
        <div className="w-px h-5 bg-cf-line" />
        <div className="text-xs font-bold truncate">
          {project?.name} · History
        </div>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          <span className="text-cf-mute">
            {snapshots.length} SNAPSHOT{snapshots.length === 1 ? "" : "S"}
          </span>
          {compareIds.length === 2 && !diff && !detail && (
            <button
              onClick={runDiff}
              className="cf-btn bg-cf-text text-cf-bg px-3 py-1 font-bold flex items-center gap-1 hover:bg-zinc-200 transition-colors"
              data-testid="run-diff-button"
            >
              <GitDiff size={11} weight="bold" /> COMPARE 2 SELECTED
            </button>
          )}
          {compareIds.length > 0 && !diff && !detail && (
            <button
              onClick={() => setCompareIds([])}
              className="text-cf-mute hover:text-cf-text px-2 py-1"
              data-testid="clear-compare"
            >
              <X size={11} /> CLEAR
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
        {!detail && !diff && (
          <>
            <div className="mb-8">
              <div className="overline mb-2">▸ PROMPT REPLAY · DIFF VIEWER</div>
              <h1 className="font-display font-black text-4xl tracking-tighter">
                History
              </h1>
              <p className="text-sm text-cf-dim mt-2 max-w-xl">
                Every prompt and export is auto-snapshotted with the graph that
                produced it. Tick two snapshots to diff them.
              </p>
            </div>
            <SnapshotList
              snapshots={snapshots}
              onOpen={openSnapshot}
              onCompare={toggleCompare}
              onDelete={removeSnapshot}
              compareSet={compareSet}
            />
          </>
        )}
        {detail && !diff && (
          <SnapshotDetail
            snapshot={detail}
            onBack={() => setDetail(null)}
          />
        )}
        {diff && (
          <DiffView
            diff={diff}
            onClose={() => {
              setDiff(null);
              setCompareIds([]);
            }}
          />
        )}
      </main>
    </div>
  );
}
