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

export const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post("/users/me/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
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
