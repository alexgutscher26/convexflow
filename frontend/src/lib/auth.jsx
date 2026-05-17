import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("cf_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cf_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        localStorage.setItem("cf_user", JSON.stringify(r.data));
      })
      .catch(() => {
        localStorage.removeItem("cf_token");
        localStorage.removeItem("cf_refresh_token");
        localStorage.removeItem("cf_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("cf_token", data.token);
    localStorage.setItem("cf_refresh_token", data.refresh_token);
    localStorage.setItem("cf_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    localStorage.setItem("cf_token", data.token);
    localStorage.setItem("cf_refresh_token", data.refresh_token);
    localStorage.setItem("cf_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("cf_refresh_token");
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      } catch (err) {
        console.error("Logout request failed:", err);
      }
    }
    localStorage.removeItem("cf_token");
    localStorage.removeItem("cf_refresh_token");
    localStorage.removeItem("cf_user");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
