import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Welcome to CortexFlow");
      nav("/app");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text flex font-mono">
      <div className="hidden lg:flex flex-1 border-r border-cf-line p-12 flex-col justify-between bg-cf-surface">
        <Link to="/" className="flex items-center gap-2" data-testid="register-brand">
          <div className="w-6 h-6 bg-cf-text" />
          <span className="font-display font-black tracking-tighter text-lg">
            CORTEXFLOW
          </span>
        </Link>
        <div>
          <div className="overline mb-3">▸ NEW ACCOUNT</div>
          <h1 className="font-display font-black tracking-tighter text-5xl leading-none">
            Start a project
            <br />
            in 60 seconds.
          </h1>
          <p className="text-sm text-cf-dim mt-6 max-w-md leading-relaxed">
            Sign up to spin up an infinite canvas. Drop in nodes. Connect a
            repo. Generate prompts.
          </p>
        </div>
        <div className="text-xs text-cf-mute">
          Already a member?{" "}
          <Link to="/login" className="text-cf-text underline">Sign in.</Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form
          onSubmit={submit}
          className="w-full max-w-sm border border-cf-line bg-cf-surface p-8"
          data-testid="register-form"
        >
          <div className="overline mb-2">▸ CREATE</div>
          <h2 className="font-display font-black text-3xl tracking-tighter mb-8">
            Create account
          </h2>
          <label className="block mb-4">
            <span className="overline">NAME</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
              data-testid="register-name"
            />
          </label>
          <label className="block mb-4">
            <span className="overline">EMAIL</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
              data-testid="register-email"
              autoComplete="email"
            />
          </label>
          <label className="block mb-6">
            <span className="overline">PASSWORD (6+)</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full bg-cf-bg border border-cf-line px-3 py-2 text-sm focus:outline-none focus:border-cf-text"
              data-testid="register-password"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="cf-btn w-full bg-cf-text text-cf-bg py-3 font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
            data-testid="register-submit"
          >
            {loading ? "CREATING..." : "CREATE ACCOUNT →"}
          </button>
          <div className="text-xs text-cf-mute mt-6 text-center">
            Already a member?{" "}
            <Link to="/login" className="text-cf-text underline" data-testid="register-link-login">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
