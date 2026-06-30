import apiClient from "./apiClient";
import { setTokens, clearTokens } from "./tokenService";

/**
 * Log in user and store tokens
 */
export const login = async (data) => {
  const response = await apiClient.post("/auth/login", data);
  const { accessToken, refreshToken } = response.data;
  setTokens({ accessToken, refreshToken });
  return response.data;
};

/**
 * Register a new user
 */
export const register = async (data) => {
  const response = await apiClient.post("/auth/register", data);
  const { accessToken, refreshToken } = response.data;
  setTokens({ accessToken, refreshToken });
  return response.data;
};

/**
 * Log out user and clear tokens
 */
export const logout = async () => {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    clearTokens();
  }
};

/**
 * Get current user profile
 */
export const getProfile = async () => {
  const response = await apiClient.get("/auth/me");
  return response.data;
};

/**
 * Complete onboarding setup
 */
export const completeOnboarding = async (organization, template, invites) => {
  const response = await apiClient.post("/auth/complete-onboarding", {
    organization,
    template,
    invites,
  });
  return response.data;
};

/**
 * Request password reset
 */
export const forgotPassword = async (email) => {
  const response = await apiClient.post("/auth/forgot-password", { email });
  return response.data;
};

/**
 * Reset password with token
 */
export const resetPassword = async (data) => {
  const response = await apiClient.post("/auth/reset-password", data);
  return response.data;
};

/**
 * Send email verification
 */
export const sendVerificationEmail = async () => {
  const response = await apiClient.post("/auth/send-verification");
  return response.data;
};

/**
 * Verify email with token
 */
export const verifyEmail = async (token) => {
  const response = await apiClient.post("/auth/verify-email", { token });
  return response.data;
};

/**
 * Get email verification status
 */
export const getVerificationStatus = async () => {
  const response = await apiClient.get("/auth/verification-status");
  return response.data;
};

/**
 * Get Google OAuth Login URL
 */
export const getGoogleAuthUrl = () => {
  return `${import.meta.env.VITE_API_URL || "/api/v1"}/auth/google`;
};

/**
 * Verify reset password token
 */
export const verifyResetToken = async (token) => {
  const response = await apiClient.post("/auth/verify-reset-token", { token });
  return response.data;
};

// Export as a unified object default export for compatibility
const authService = {
  login,
  register,
  logout,
  getProfile,
  completeOnboarding,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  getVerificationStatus,
  getGoogleAuthUrl,
  verifyResetToken,
};

export default authService;
