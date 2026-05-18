// handles auth requests
import apiClient from "./apiClient";
import { setTokens, clearTokens } from "./tokenService";

export const login = async (data) => {
  const response = await apiClient.post("/auth/login", data);

  const { accessToken, refreshToken } = response.data;

  setTokens({ accessToken, refreshToken });

  return response.data;
};

export const register = async (data) => {
  const response = await apiClient.post("/auth/register", data);

  return response.data;
};

export const logout = async () => {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    clearTokens();
  }
};

export const forgotPassword = async (email) => {
  return apiClient.post("/auth/forgot-password", { email });
};

export const resetPassword = async (data) => {
  return apiClient.post("/auth/reset-password", data);
};