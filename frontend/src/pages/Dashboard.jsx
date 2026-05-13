import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, SignOut, Trash, Graph } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("greenfield");
  const [template, setTemplate] = useState("blank");
  const [templates, setTemplates] = useState([
    { id: "blank", label: "Blank", description: "Empty canvas — build from scratch." },
  ]);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
    } catch (e) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get("/templates")
      .then((r) => setTemplates(r.data.templates || []))
      .catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/projects", {
        name,
        description,
        project_type: projectType,
        template,
      });
      toast.success(template === "blank" ? "Project created" : "Project seeded from template");
      nav(`/app/project/${data.id}`);
    } catch (e) {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm("Delete project? This cannot be undone.")) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success("Project deleted");
      load();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const onLogout = () => {
    logout();
    nav("/");
  };

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text font-mono">
      <header className="border-b border-cf-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2" data-testid="dashboard-brand">
            <div className="w-6 h-6 bg-cf-text" />
            <span className="font-display font-black tracking-tighter text-lg">
              CORTEXFLOW
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-cf-dim" data-testid="dashboard-user">
              {user?.email}
            </span>
            <button
              onClick={onLogout}
              className="cf-btn px-3 py-2 border border-cf-line hover:bg-cf-elev text-cf-dim hover:text-cf-text transition-colors flex items-center gap-2"
              data-testid="logout-button"
            >
              <SignOut size={14} /> SIGN OUT
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <div className="overline mb-3">▸ WORKSPACE</div>
            <h1 className="font-display font-black tracking-tighter text-4xl lg:text-5xl">
              Projects
            </h1>
            <p className="text-sm text-cf-dim mt-2">
              {projects.length} active project{projects.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="cf-btn bg-cf-text text-cf-bg px-5 py-3 font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2"
            data-testid="new-project-button"
          >
            <Plus size={16} weight="bold" /> NEW PROJECT
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-cf-dim overline">▸ LOADING</div>
        ) : projects.length === 0 ? (
          <div className="border border-cf-line bg-cf-surface p-12 text-center">
            <Graph size={48} className="mx-auto text-cf-mute" weight="duotone" />
            <h3 className="font-display font-bold text-2xl mt-4 tracking-tight">
              No projects yet
            </h3>
            <p className="text-sm text-cf-dim mt-2">
              Spin up your first graph — it takes a minute.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="cf-btn bg-cf-text text-cf-bg px-5 py-3 font-bold mt-6 inline-flex items-center gap-2 hover:bg-zinc-200 transition-colors"
              data-testid="empty-new-project"
            >
              <Plus size={16} weight="bold" /> CREATE PROJECT
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <Link
                key={p.id}
                to={`/app/project/${p.id}`}
                className="border border-cf-line -ml-px -mt-px p-6 hover:bg-cf-surface transition-colors block group"
                data-testid={`project-card-${i}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="overline">▸ PROJECT</div>
                  <button
                    onClick={(e) => remove(p.id, e)}
                    className="text-cf-mute hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`delete-project-${i}`}
                    aria-label="Delete project"
                  >
                    <Trash size={14} />
                  </button>
                </div>
                <h3 className="font-display font-bold text-xl tracking-tight mt-3 break-words">
                  {p.name}
                </h3>
                {p.description && (
                  <p className="text-xs text-cf-dim mt-2 line-clamp-3 leading-relaxed">
                    {p.description}
                  </p>
                )}
                <div className="text-[10px] text-cf-mute mt-4 uppercase tracking-widest">
                  Updated {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <div
          className="fixed inset-0 bg-cf-bg/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={create}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-cf-line bg-cf-surface p-8"
            data-testid="create-project-modal"
          >
            <div className="overline mb-2">▸ NEW PROJECT</div>
            <h2 className="font-display font-black text-2xl tracking-tighter mb-6">
              Create project
            </h2>
            <label className="block mb-4">
              <span className="overline">NAME</span>
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
                data-testid="new-project-name"
              />
            </label>
            <label className="block mb-4">
              <span className="overline">DESCRIPTION (OPTIONAL)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text resize-none"
                data-testid="new-project-description"
              />
            </label>
            <div className="mb-6">
              <span className="overline">PROJECT TYPE</span>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {[
                  { v: "greenfield", l: "GREENFIELD" },
                  { v: "existing", l: "EXISTING" },
                  { v: "feature", l: "FEATURE" },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.v}
                    onClick={() => setProjectType(t.v)}
                    className={`cf-btn border px-2 py-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${
                      projectType === t.v
                        ? "bg-cf-text text-cf-bg border-cf-text"
                        : "border-cf-line text-cf-dim hover:bg-cf-elev"
                    }`}
                    data-testid={`project-type-${t.v}`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <span className="overline">START FROM TEMPLATE</span>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {templates.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`cf-btn border px-3 py-2 text-left transition-colors ${
                      template === t.id
                        ? "bg-cf-elev border-cf-text"
                        : "border-cf-line hover:bg-cf-elev"
                    }`}
                    data-testid={`template-${t.id}`}
                    title={t.description}
                  >
                    <div className="text-[10px] uppercase tracking-widest font-bold text-cf-text">
                      {t.label}
                    </div>
                    <div className="text-[9px] text-cf-mute mt-0.5 leading-tight line-clamp-2">
                      {t.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="cf-btn flex-1 border border-cf-line py-3 font-bold hover:bg-cf-elev transition-colors"
                data-testid="cancel-project-button"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={creating}
                className="cf-btn flex-1 bg-cf-text text-cf-bg py-3 font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                data-testid="confirm-create-project"
              >
                {creating ? "CREATING..." : "CREATE →"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
