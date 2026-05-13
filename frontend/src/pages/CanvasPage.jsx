import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";
import {
  ArrowLeft,
  PencilSimple,
  PlusCircle,
  Command,
  CheckCircle,
  CircleNotch,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { NODE_TYPE_MAP, EDGE_RELATIONSHIPS, EDGE_REL_MAP } from "@/lib/nodeTypes";
import { CustomNode } from "@/components/canvas/CustomNode";
import Sidebar from "@/components/canvas/Sidebar";
import Inspector from "@/components/canvas/Inspector";
import Console from "@/components/canvas/Console";
import CommandPalette from "@/components/canvas/CommandPalette";

const nodeTypes = { cf: CustomNode };

function toRfNode(n) {
  return {
    id: n.id,
    type: "cf",
    position: { x: n.position_x || 0, y: n.position_y || 0 },
    data: {
      type: n.type,
      title: n.title,
      content: n.content,
      file_references: n.file_references || [],
    },
  };
}

function toRfEdge(e) {
  const rel = EDGE_REL_MAP[e.relationship_type] || EDGE_REL_MAP.depends_on;
  return {
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    animated: true,
    type: "smoothstep",
    label: rel.label,
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 0,
    labelBgStyle: { fill: "#0a0a0b", stroke: rel.color, strokeWidth: 1 },
    labelStyle: {
      fill: rel.color,
      fontSize: 9,
      fontFamily: "JetBrains Mono",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
    style: { stroke: rel.color },
    data: { relationship_type: e.relationship_type },
  };
}

function CanvasInner() {
  const { id: projectId } = useParams();
  const nav = useNavigate();
  const flowWrapper = useRef(null);
  const { project: rfProject, screenToFlowPosition, fitView } = useReactFlow();

  const [project, setProject] = useState(null);
  const [rawNodes, setRawNodes] = useState([]); // backend nodes
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [pendingConn, setPendingConn] = useState(null);
  const saveStateTimer = useRef(null);
  const markSaving = useCallback(() => {
    setSaveState("saving");
    if (saveStateTimer.current) clearTimeout(saveStateTimer.current);
  }, []);
  const markSaved = useCallback(() => {
    setSaveState("saved");
    if (saveStateTimer.current) clearTimeout(saveStateTimer.current);
    saveStateTimer.current = setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const selectedNode = useMemo(
    () => rawNodes.find((n) => n.id === selectedId),
    [rawNodes, selectedId],
  );

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const [p, n, e] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/projects/${projectId}/nodes`),
          api.get(`/projects/${projectId}/edges`),
        ]);
        setProject(p.data);
        setRawNodes(n.data);
        setNodes(n.data.map(toRfNode));
        setEdges(e.data.map(toRfEdge));
      } catch (err) {
        toast.error("Failed to load project");
        nav("/app");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, nav]);

  const reloadGraph = useCallback(async () => {
    try {
      const [n, e] = await Promise.all([
        api.get(`/projects/${projectId}/nodes`),
        api.get(`/projects/${projectId}/edges`),
      ]);
      setRawNodes(n.data);
      setNodes((rfNodes) => {
        const byId = new Map(rfNodes.map((r) => [r.id, r]));
        return n.data.map((nd) => {
          const ex = byId.get(nd.id);
          return ex
            ? { ...ex, position: { x: nd.position_x, y: nd.position_y }, data: { type: nd.type, title: nd.title, content: nd.content, file_references: nd.file_references || [] } }
            : toRfNode(nd);
        });
      });
      setEdges(e.data.map(toRfEdge));
    } catch (err) {
      // ignore
    }
  }, [projectId]);

  // expose fitView via ref
  const fitViewRef = useRef(null);
  const aiAssistRef = useRef(null);
  useEffect(() => {
    fitViewRef.current = () => fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        e.target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        if (aiAssistRef.current && selectedId) aiAssistRef.current();
      }
      if (e.key.toLowerCase() === "f" && !isEditable && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        fitViewRef.current?.();
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  // sync rawNodes -> rf nodes when data changes (for content / title preview etc)
  useEffect(() => {
    setNodes((rfNodes) =>
      rfNodes.map((rn) => {
        const raw = rawNodes.find((r) => r.id === rn.id);
        if (!raw) return rn;
        return {
          ...rn,
          data: {
            type: raw.type,
            title: raw.title,
            content: raw.content,
            file_references: raw.file_references || [],
          },
        };
      }),
    );
  }, [rawNodes]);

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    // persist drag position
    changes.forEach((ch) => {
      if (ch.type === "position" && ch.dragging === false && ch.position) {
        markSaving();
        api
          .put(`/nodes/${ch.id}`, {
            position_x: ch.position.x,
            position_y: ch.position.y,
          })
          .then(markSaved)
          .catch(() => {});
      }
      if (ch.type === "select") {
        if (ch.selected) setSelectedId(ch.id);
      }
    });
  }, [markSaving, markSaved]);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    changes.forEach((ch) => {
      if (ch.type === "remove") {
        api.delete(`/edges/${ch.id}`).catch(() => {});
      }
    });
  }, []);

  const onConnect = useCallback(
    async (conn) => {
      try {
        const { data } = await api.post(`/projects/${projectId}/edges`, {
          source_node_id: conn.source,
          target_node_id: conn.target,
        });
        setEdges((eds) =>
          addEdge(
            { ...toRfEdge(data) },
            eds,
          ),
        );
      } catch (e) {
        toast.error("Failed to connect");
      }
    },
    [projectId],
  );

  const addNodeAt = useCallback(
    async (type, position) => {
      const cfg = NODE_TYPE_MAP[type];
      if (!cfg) return;
      try {
        const { data } = await api.post(`/projects/${projectId}/nodes`, {
          type,
          title: cfg.type,
          content: cfg.template,
          position_x: position.x,
          position_y: position.y,
        });
        setRawNodes((rs) => [...rs, data]);
        setNodes((ns) => [...ns, toRfNode(data)]);
        setSelectedId(data.id);
      } catch (e) {
        toast.error("Failed to add node");
      }
    },
    [projectId],
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/cf-node-type");
      if (!type) return;
      const pos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNodeAt(type, pos);
    },
    [screenToFlowPosition, addNodeAt],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const addNodeAtCenter = useCallback(
    (type) => {
      const rect = flowWrapper.current?.getBoundingClientRect();
      const pos = screenToFlowPosition({
        x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
        y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
      });
      addNodeAt(type, pos);
    },
    [screenToFlowPosition, addNodeAt],
  );

  const updateNode = useCallback(async (nodeId, patch) => {
    try {
      markSaving();
      const { data } = await api.put(`/nodes/${nodeId}`, patch);
      setRawNodes((rs) => rs.map((r) => (r.id === nodeId ? data : r)));
      markSaved();
    } catch (e) {
      toast.error("Failed to save");
    }
  }, [markSaving, markSaved]);

  const deleteNode = useCallback(
    async (nodeId) => {
      if (!window.confirm("Delete node?")) return;
      try {
        await api.delete(`/nodes/${nodeId}`);
        setRawNodes((rs) => rs.filter((r) => r.id !== nodeId));
        setNodes((ns) => ns.filter((n) => n.id !== nodeId));
        setEdges((es) =>
          es.filter((e) => e.source !== nodeId && e.target !== nodeId),
        );
        if (selectedId === nodeId) setSelectedId(null);
      } catch (e) {
        toast.error("Delete failed");
      }
    },
    [selectedId],
  );

  const attachFile = useCallback(
    (path) => {
      if (!selectedNode) return;
      const refs = new Set(selectedNode.file_references || []);
      refs.add(path);
      updateNode(selectedNode.id, { file_references: Array.from(refs) });
      toast.success("File attached");
    },
    [selectedNode, updateNode],
  );

  const renameProject = async (newName) => {
    if (!newName.trim() || newName === project.name) {
      setEditName(false);
      return;
    }
    try {
      const { data } = await api.put(`/projects/${projectId}`, { name: newName });
      setProject(data);
      toast.success("Renamed");
    } catch {
      toast.error("Rename failed");
    } finally {
      setEditName(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-cf-bg text-cf-dim font-mono text-xs">
        <span className="overline">▸ LOADING CANVAS</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-cf-bg text-cf-text font-mono overflow-hidden">
      {/* header */}
      <header className="h-12 border-b border-cf-line flex items-center px-4 gap-3 shrink-0">
        <Link
          to="/app"
          className="text-cf-dim hover:text-cf-text flex items-center gap-2 text-xs"
          data-testid="back-to-dashboard"
        >
          <ArrowLeft size={14} /> PROJECTS
        </Link>
        <div className="w-px h-5 bg-cf-line" />
        {editName ? (
          <input
            autoFocus
            defaultValue={project.name}
            onBlur={(e) => renameProject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") renameProject(e.target.value);
              if (e.key === "Escape") setEditName(false);
            }}
            className="bg-cf-bg border border-cf-line px-2 py-0.5 text-xs font-bold focus:outline-none focus:border-cf-text"
            data-testid="project-name-input"
          />
        ) : (
          <button
            onClick={() => setEditName(true)}
            className="flex items-center gap-2 text-xs font-bold hover:text-cf-dim group"
            data-testid="project-name-button"
          >
            {project.name}
            <PencilSimple size={11} className="opacity-0 group-hover:opacity-100 text-cf-mute" />
          </button>
        )}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-cf-mute">
          <span data-testid="save-state" className="flex items-center gap-1">
            {saveState === "saving" && (
              <>
                <CircleNotch size={10} className="animate-spin" />
                <span>SAVING</span>
              </>
            )}
            {saveState === "saved" && (
              <>
                <CheckCircle size={10} weight="fill" className="text-emerald-500" />
                <span>SAVED</span>
              </>
            )}
            {saveState === "idle" && <span className="opacity-40">SYNCED</span>}
          </span>
          <span>·</span>
          <span data-testid="nodes-count">{rawNodes.length} NODES</span>
          <span>·</span>
          <span data-testid="edges-count">{edges.length} EDGES</span>
          <span>·</span>
          <button
            onClick={() => fitViewRef.current?.()}
            className="cf-btn border border-cf-line px-2 py-1 hover:bg-cf-elev text-cf-dim hover:text-cf-text transition-colors"
            data-testid="fit-canvas"
            title="Fit canvas (F)"
          >
            FIT
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="cf-btn flex items-center gap-1 border border-cf-line px-2 py-1 hover:bg-cf-elev text-cf-dim hover:text-cf-text transition-colors"
            data-testid="open-command-palette"
          >
            <Command size={10} /> K
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          project={project}
          onProjectUpdate={(p) => {
            setProject(p);
            // repo scan may have created/updated a GitHub Context node
            if (p.repository) reloadGraph();
          }}
          onDragNode={addNodeAtCenter}
          onAttachFile={attachFile}
          selectedNodeId={selectedId}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={flowWrapper}
            className="flex-1 relative"
            onDrop={onDrop}
            onDragOver={onDragOver}
            data-testid="react-flow-canvas"
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onPaneClick={() => setSelectedId(null)}
              fitView
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ type: "smoothstep", animated: true }}
            >
              <Background gap={24} size={1.5} color="#3f3f46" />
              <Controls position="bottom-left" />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => {
                  const cfg = NODE_TYPE_MAP[n.data?.type];
                  return cfg?.bg || "#27272a";
                }}
                maskColor="rgba(10,10,11,0.7)"
              />
            </ReactFlow>
            {rawNodes.length === 0 && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-center pointer-events-auto border border-cf-line bg-cf-surface/80 backdrop-blur px-8 py-6">
                  <PlusCircle size={32} weight="duotone" className="mx-auto text-cf-dim" />
                  <p className="text-sm font-bold mt-3">Empty canvas</p>
                  <p className="text-xs text-cf-mute mt-1">
                    Drag a node from the sidebar — or press{" "}
                    <kbd className="border border-cf-line px-1">⌘K</kbd>
                  </p>
                </div>
              </div>
            )}
          </div>
          <Console
            projectId={projectId}
            selectedNodeIds={selectedId ? [selectedId] : []}
            onNodeCreated={(node) => {
              setRawNodes((rs) => [...rs, node]);
              setNodes((ns) => [...ns, toRfNode(node)]);
              setSelectedId(node.id);
            }}
          />
        </div>

        <Inspector
          node={selectedNode}
          onChange={updateNode}
          onDelete={deleteNode}
          onClose={() => setSelectedId(null)}
          aiAssistRef={aiAssistRef}
        />
      </div>

      {pendingConn && (
        <div
          className="fixed inset-0 bg-cf-bg/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPendingConn(null)}
          data-testid="edge-relationship-modal"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm border border-cf-line bg-cf-surface p-6"
          >
            <div className="overline mb-2">▸ EDGE RELATIONSHIP</div>
            <h3 className="font-display font-black text-2xl tracking-tighter mb-5">
              How are these linked?
            </h3>
            <div className="space-y-1">
              {EDGE_RELATIONSHIPS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => confirmConnect(r.value)}
                  className="w-full flex items-center gap-3 border border-cf-line px-3 py-2 hover:bg-cf-elev transition-colors text-left"
                  data-testid={`edge-rel-${r.value}`}
                >
                  <div className="w-2 h-6" style={{ background: r.color }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: r.color }}>
                    {r.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingConn(null)}
              className="cf-btn w-full mt-4 border border-cf-line py-2 text-[11px] font-bold hover:bg-cf-elev transition-colors"
              data-testid="edge-rel-cancel"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(type) => {
          setPaletteOpen(false);
          addNodeAtCenter(type);
        }}
      />
    </div>
  );
}

export default function CanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
