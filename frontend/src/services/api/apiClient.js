// centeralized http client handles base url, headers, token injection, refresh logic, etc.
import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./tokenService";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});


// =========================
// REQUEST INTERCEPTOR
// =========================

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => Promise.reject(error)
);


// =========================
// RESPONSE INTERCEPTOR
// =========================

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          {
            refreshToken,
          }
        );

        const { accessToken, refreshToken: newRefreshToken } =
          response.data;

        setTokens({
          accessToken,
          refreshToken: newRefreshToken,
        });

        originalRequest.headers.Authorization =
          `Bearer ${accessToken}`;

        return apiClient(originalRequest);

      } catch (refreshError) {
        clearTokens();

        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;