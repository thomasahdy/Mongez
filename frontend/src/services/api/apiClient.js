// Centralized HTTP client: base URL, credentials, token injection, CSRF, and refresh.
import axios from "axios";
import {
  getAccessToken,
  setTokens,
  clearTokens,
} from "./tokenService";
import { showToastBridge } from "../../context/ToastContext";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";
const unsafeMethods = new Set(["post", "put", "patch", "delete"]);

let csrfTokenValue = null;
let csrfTokenFetchedAt = 0;
const CSRF_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const getCsrfToken = async (force = false) => {
  const isStale = Date.now() - csrfTokenFetchedAt > CSRF_TTL_MS;
  if (csrfTokenValue && !isStale && !force) {
    return csrfTokenValue;
  }

  const response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
    withCredentials: true,
  });

  csrfTokenValue = response.data?.data?.csrfToken;
  csrfTokenFetchedAt = Date.now();
  return csrfTokenValue;
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      if (typeof config.headers?.delete === "function") {
        config.headers.setContentType?.(undefined);
        config.headers.delete(["Content-Type", "content-type"]);
      } else {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }

    const method = config.method?.toLowerCase();

    if (unsafeMethods.has(method)) {
      const token = await getCsrfToken();

      if (token) {
        config.headers["X-CSRF-Token"] = token;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === true && 'data' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    const shouldSkipRefresh = [
      "/auth/login",
      "/auth/register",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/refresh",
    ].some((url) => originalRequest?.url?.includes(url));
    
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !shouldSkipRefresh) {
      const path = window.location.pathname;
      const isPublicRoute = ['/login', '/register', '/reset-password', '/verify-email', '/'].includes(path);
      originalRequest._retry = true;

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } =
          response.data?.data ?? response.data;

        setTokens({
          accessToken,
        });

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();
        if (!isPublicRoute && !shouldSkipRefresh) {
          showToastBridge({ key: "toasts.sessionExpired" }, "error");
          
          setTimeout(() => {
            window.location.href = '/login';
          }, 300);
        }

        return Promise.reject(refreshError);
      }
    }

    // Handle 403 errors for unsafe methods - re-fetch CSRF and retry once
    if (
      error.response?.status === 403 &&
      originalRequest &&
      !originalRequest._csrfRetry &&
      unsafeMethods.has(originalRequest.method?.toLowerCase())
    ) {
      originalRequest._csrfRetry = true;

      try {
        const freshToken = await getCsrfToken(true); // Force re-fetch
        originalRequest.headers['X-CSRF-Token'] = freshToken;
        return apiClient(originalRequest);
      } catch {
        // If CSRF re-fetch fails, reject with original error
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
