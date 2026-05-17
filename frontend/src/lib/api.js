import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      const onAuth = ["/login", "/register"].includes(
        window.location.pathname,
      );
      if (onAuth) {
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((queueErr) => Promise.reject(queueErr));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("cf_refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          localStorage.setItem("cf_token", data.token);
          localStorage.setItem("cf_refresh_token", data.refresh_token);
          if (data.user) {
            localStorage.setItem("cf_user", JSON.stringify(data.user));
          }

          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          processQueue(null, data.token);
          isRefreshing = false;
          return api(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          isRefreshing = false;
          localStorage.removeItem("cf_token");
          localStorage.removeItem("cf_refresh_token");
          localStorage.removeItem("cf_user");
          window.location.href = "/login";
          return Promise.reject(refreshErr);
        }
      } else {
        localStorage.removeItem("cf_token");
        localStorage.removeItem("cf_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);
