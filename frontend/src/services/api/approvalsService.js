import apiClient from "./apiClient";

/**
 * Approvals API Service
 * Maps backend routes for task-level approvals (Create, list, resolve, withdraw).
 */

export const requestApproval = async (taskId, data) => {
  const response = await apiClient.post(`/tasks/${taskId}/approvals`, data);
  return response.data;
};

export const listForTask = async (taskId, params = {}) => {
  const response = await apiClient.get(`/tasks/${taskId}/approvals`, { params });
  return response.data;
};

export const getPending = async (params = {}) => {
  const response = await apiClient.get("/approvals/pending", { params });
  return response.data;
};

export const resolve = async (id, data) => {
  const response = await apiClient.patch(`/approvals/${id}`, data);
  return response.data;
};

export const withdraw = async (id) => {
  await apiClient.delete(`/approvals/${id}`);
};

export default {
  requestApproval,
  listForTask,
  getPending,
  resolve,
  withdraw,
};
