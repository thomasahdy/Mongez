import apiClient from "./apiClient";

export const getCurrentUser = async () => {
  const response = await apiClient.get("/users/me");
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await apiClient.patch("/users/me", profileData);
  return response.data;
};

export const getUserPreferences = async () => {
  const response = await apiClient.get("/users/me/preferences");
  return response.data;
};

export const updateUserPreferences = async (preferencesData) => {
  const response = await apiClient.patch("/users/me/preferences", preferencesData);
  return response.data;
};

export const uploadAvatar = async () => {
  throw new Error("Direct avatar uploads are not available through the current API contract.");
};

// Backward-compatible aliases for older imports.
export const getUserSettings = getUserPreferences;
export const updateUserSettings = updateUserPreferences;

const userService = {
  getCurrentUser,
  updateProfile,
  getUserPreferences,
  updateUserPreferences,
  getUserSettings,
  updateUserSettings,
  uploadAvatar,
};

export default userService;
