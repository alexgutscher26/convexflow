import { useState } from "react";
import { toast } from "sonner";
import {
  GithubLogo,
  ArrowsClockwise,
  Folder,
  File as FileIcon,
  CaretDown,
  CaretRight,
  Sparkle,
} from "@phosphor-icons/react";
import { NODE_TYPES } from "@/lib/nodeTypes";
import { api } from "@/lib/api";

function buildFlatTree(files, open) {
  const root = { name: "", path: "", children: {}, files: [] };
  files.slice(0, 600).forEach((f) => {
    if (f.type !== "blob") return;
    const parts = f.path.split("/");
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      cur.children[seg] = cur.children[seg] || {
        name: seg,
        path: parts.slice(0, i + 1).join("/"),
        children: {},
        files: [],
      };
      cur = cur.children[seg];
    }
    cur.files.push({ name: parts[parts.length - 1], path: f.path });
  });

  const out = [];
  const stack = [{ node: root, depth: -1 }];
  while (stack.length) {
    const { node, depth } = stack.pop();
    if (node.path !== "") {
      out.push({ kind: "dir", name: node.name, path: node.path, depth });
    }
    const isOpen = node.path === "" || open[node.path];
    if (!isOpen) continue;
    // push files
    for (const f of node.files) {
      out.push({ kind: "file", name: f.name, path: f.path, depth: depth + 1 });
    }
    // push children (reverse so they pop in order)
    const kids = Object.values(node.children).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push({ node: kids[i], depth: depth + 1 });
    }
  }
  return out;
}

function FileTree({ files, onPick }) {
  const [open, setOpen] = useState({});
  const items = buildFlatTree(files, open);
  return (
    <div>
      {items.map((it) =>
        it.kind === "dir" ? (
          <button
            key={`d-${it.path}`}
            onClick={() =>
              setOpen((o) => ({ ...o, [it.path]: !o[it.path] }))
            }
            className="w-full flex items-center gap-1 px-2 py-1 text-[11px] hover:bg-cf-elev text-cf-dim"
            style={{ paddingLeft: it.depth * 10 + 6 }}
            data-testid={`repo-dir-${it.path}`}
          >
            {open[it.path] ? (
              <CaretDown size={10} />
            ) : (
              <CaretRight size={10} />
            )}
            <Folder size={11} className="text-cf-mute" />
            <span className="truncate">{it.name}</span>
          </button>
        ) : (
          <button
            key={`f-${it.path}`}
            onClick={() => onPick(it.path)}
            className="w-full flex items-center gap-1 px-2 py-1 text-[11px] hover:bg-cf-elev text-cf-text"
            style={{ paddingLeft: it.depth * 10 + 6 }}
            title="Attach to selected node"
            data-testid={`repo-file-${it.path}`}
          >
            <FileIcon size={11} className="text-cf-mute" />
            <span className="truncate">{it.name}</span>
          </button>
        ),
      )}
    </div>
  );
}

export default function Sidebar({ project, onProjectUpdate, onDragNode, onAttachFile, selectedNodeId }) {
  const [tab, setTab] = useState("nodes");
  const [showConnect, setShowConnect] = useState(false);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [pat, setPat] = useState("");
  const [working, setWorking] = useState(false);

  const repository = project?.repository;

  const connect = async (e) => {
    e.preventDefault();
    setWorking(true);
    try {
      const { data } = await api.post(`/projects/${project.id}/repository`, {
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch.trim() || "main",
        pat: pat.trim(),
      });
      toast.success("Repository connected. Scanning...");
      onProjectUpdate({ ...project, repository: data });
      setShowConnect(false);
      // auto scan
      const scan = await api.post(`/projects/${project.id}/repository/scan`);
      onProjectUpdate({ ...project, repository: scan.data });
      toast.success(`Scan complete · ${scan.data.frameworks?.length || 0} frameworks`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Connect failed");
    } finally {
      setWorking(false);
    }
  };

  const rescan = async () => {
    setWorking(true);
    try {
      const { data } = await api.post(`/projects/${project.id}/repository/scan`);
      onProjectUpdate({ ...project, repository: data });
      toast.success("Scan complete");
    } catch (e) {
      toast.error("Scan failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <aside className="w-64 border-r border-cf-line bg-cf-bg h-full flex flex-col z-10">
      <div className="flex border-b border-cf-line">
        <button
          onClick={() => setTab("nodes")}
          className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${
            tab === "nodes"
              ? "bg-cf-elev text-cf-text"
              : "text-cf-dim hover:bg-cf-elev"
          }`}
          data-testid="sidebar-tab-nodes"
        >
          NODES
        </button>
        <button
          onClick={() => setTab("repo")}
          className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-widest font-bold border-l border-cf-line transition-colors ${
            tab === "repo"
              ? "bg-cf-elev text-cf-text"
              : "text-cf-dim hover:bg-cf-elev"
          }`}
          data-testid="sidebar-tab-repo"
        >
          REPO
        </button>
      </div>

      {tab === "nodes" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 overline border-b border-cf-line">
            ▸ NODE LIBRARY · DRAG TO CANVAS
          </div>
          {NODE_TYPES.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/cf-node-type", n.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDoubleClick={() => onDragNode(n.type)}
                className="px-3 py-2 border-b border-cf-line hover:bg-cf-elev cursor-grab active:cursor-grabbing flex items-center gap-2"
                data-testid={`sidebar-node-${n.short.toLowerCase()}`}
                title="Drag to canvas or double-click to add at center"
              >
                <div className="w-1 h-7 shrink-0" style={{ background: n.bg }} />
                <Icon size={14} weight="bold" className="text-cf-dim shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-cf-text truncate">
                    {n.type}
                  </div>
                  <div className="text-[10px] text-cf-mute truncate">
                    {n.short}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "repo" && (
        <div className="flex-1 overflow-y-auto">
          {!repository && (
            <div className="p-4">
              <div className="overline mb-2">▸ NO REPO CONNECTED</div>
              <p className="text-[11px] text-cf-dim leading-relaxed mb-3">
                Connect a GitHub repository to ground AI prompts in your actual
                codebase.
              </p>
              <button
                onClick={() => setShowConnect(true)}
                className="cf-btn w-full bg-cf-text text-cf-bg py-2 text-[11px] font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                data-testid="connect-repo-button"
              >
                <GithubLogo size={14} weight="bold" /> CONNECT REPO
              </button>
            </div>
          )}

          {repository && (
            <div>
              <div className="px-3 py-2 border-b border-cf-line">
                <div className="flex items-center gap-2">
                  <GithubLogo size={14} weight="bold" />
                  <span className="text-[11px] font-bold truncate flex-1">
                    {repository.owner}/{repository.repo}
                  </span>
                  <button
                    onClick={rescan}
                    disabled={working}
                    className="text-cf-dim hover:text-cf-text"
                    title="Rescan"
                    data-testid="rescan-repo"
                  >
                    <ArrowsClockwise size={12} className={working ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="text-[10px] text-cf-mute mt-1">
                  branch: {repository.branch}
                </div>
                {repository.frameworks?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {repository.frameworks.map((f) => (
                      <span
                        key={f}
                        className="text-[9px] uppercase tracking-widest border border-cf-line2 px-1.5 py-0.5 text-cf-dim"
                        data-testid={`framework-badge-${f}`}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-3 py-2 overline border-b border-cf-line flex items-center justify-between">
                <span>▸ FILE TREE</span>
                {selectedNodeId ? (
                  <span className="text-[9px] text-emerald-400 normal-case tracking-normal flex items-center gap-1">
                    <Sparkle size={9} weight="fill" /> click to attach
                  </span>
                ) : (
                  <span className="text-[9px] text-cf-mute normal-case tracking-normal">
                    select a node
                  </span>
                )}
              </div>
              {repository.file_tree?.length ? (
                <FileTree
                  files={repository.file_tree}
                  onPick={(p) => {
                    if (!selectedNodeId) {
                      toast.error("Select a node first to attach this file");
                      return;
                    }
                    onAttachFile(p);
                  }}
                />
              ) : (
                <div className="px-3 py-2 text-[11px] text-cf-mute">
                  Scan to load tree.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showConnect && (
        <div
          className="fixed inset-0 bg-cf-bg/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowConnect(false)}
        >
          <form
            onSubmit={connect}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-cf-line bg-cf-surface p-6"
            data-testid="connect-repo-modal"
          >
            <div className="overline mb-2">▸ GITHUB REPO</div>
            <h3 className="font-display font-black text-2xl tracking-tighter mb-5">
              Connect repository
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="overline">OWNER</span>
                <input
                  required
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="vercel"
                  className="mt-1 w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text"
                  data-testid="repo-owner"
                />
              </label>
              <label className="block">
                <span className="overline">REPO</span>
                <input
                  required
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="next.js"
                  className="mt-1 w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text"
                  data-testid="repo-name"
                />
              </label>
            </div>
            <label className="block mb-3">
              <span className="overline">BRANCH</span>
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="mt-1 w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text"
                data-testid="repo-branch"
              />
            </label>
            <label className="block mb-5">
              <span className="overline">PAT (OPTIONAL — FOR PRIVATE REPOS)</span>
              <input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_..."
                className="mt-1 w-full bg-cf-bg border border-cf-line px-2 py-1.5 text-[12px] focus:outline-none focus:border-cf-text"
                data-testid="repo-pat"
              />
              <span className="text-[10px] text-cf-mute mt-1 block leading-snug">
                Public repos work without a token. For private, generate a
                fine-grained PAT with Contents: Read.
              </span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConnect(false)}
                className="cf-btn flex-1 border border-cf-line py-2 text-[12px] font-bold hover:bg-cf-elev transition-colors"
                data-testid="cancel-connect-repo"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={working}
                className="cf-btn flex-1 bg-cf-text text-cf-bg py-2 text-[12px] font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                data-testid="submit-connect-repo"
              >
                {working ? "CONNECTING..." : "CONNECT & SCAN →"}
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
}
