import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      nav("/app");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text flex font-mono">
      <div className="hidden lg:flex flex-1 border-r border-cf-line p-12 flex-col justify-between bg-cf-surface">
        <Link to="/" className="flex items-center gap-2" data-testid="login-brand">
          <div className="w-6 h-6 bg-cf-text" />
          <span className="font-display font-black tracking-tighter text-lg">
            CONVEXFLOW
          </span>
        </Link>
        <div>
          <div className="overline mb-3">▸ SIGN IN</div>
          <h1 className="font-display font-black tracking-tighter text-5xl leading-none">
            Welcome back
            <br />
            to the graph.
          </h1>
          <p className="text-sm text-cf-dim mt-6 max-w-md leading-relaxed">
            Resume your project intelligence. Reopen the canvas exactly where
            you left it.
          </p>
        </div>
        <div className="text-xs text-cf-mute">
          No account? <Link to="/register" className="text-cf-text underline">Create one.</Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form
          onSubmit={submit}
          className="w-full max-w-sm border border-cf-line bg-cf-surface p-8"
          data-testid="login-form"
        >
          <div className="overline mb-2">▸ AUTHENTICATE</div>
          <h2 className="font-display font-black text-3xl tracking-tighter mb-8">
            Sign in
          </h2>
          <label className="block mb-4">
            <span className="overline">EMAIL</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
              data-testid="login-email"
              autoComplete="email"
            />
          </label>
          <label className="block mb-6">
            <span className="overline">PASSWORD</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
              data-testid="login-password"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="cf-btn w-full bg-cf-text text-cf-bg py-3 font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
            data-testid="login-submit"
          >
            {loading ? "SIGNING IN..." : "SIGN IN →"}
          </button>
          <div className="text-xs text-cf-mute mt-6 text-center">
            New here?{" "}
            <Link to="/register" className="text-cf-text underline" data-testid="login-link-register">
              Create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
