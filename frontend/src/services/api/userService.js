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
  if (!file || file.size <= 0) {
    throw new Error("Selected avatar image is empty.");
  }

  const fileName = file.name || "avatar.png";
  const fileType = file.type || "application/octet-stream";
  const avatarBlob =
    typeof file.arrayBuffer === "function"
      ? new Blob([await file.arrayBuffer()], { type: fileType })
      : file;

  const formData = new FormData();
  formData.append("file", avatarBlob, fileName);

  const response = await apiClient.post("/users/me/avatar", formData);
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
