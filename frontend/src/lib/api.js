import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const onAuth = ["/login", "/register"].includes(
        window.location.pathname,
      );
      if (!onAuth) {
        localStorage.removeItem("cf_token");
        localStorage.removeItem("cf_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);
