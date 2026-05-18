// handles current user, profile updates, avatar, settings, preferences, etc.
import apiClient from './apiClient';

export const getCurrentUser = async () => {
  const response = await apiClient.get('/users/me');
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await apiClient.put('/users/me', profileData);
  return response.data;
};

export const uploadAvatar = async (avatarFile) => {
  const formData = new FormData();
  formData.append('avatar', avatarFile);
  const response = await apiClient.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getUserSettings = async () => {
  const response = await apiClient.get('/users/me/settings');
  return response.data;
};

export const updateUserSettings = async (settingsData) => {
  const response = await apiClient.put('/users/me/settings', settingsData);
  return response.data;
};
