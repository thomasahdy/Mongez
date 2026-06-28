import apiClient from "./apiClient";

/**
 * Workflow API Service
 * Maps backend routes for workflow definitions, initiation, instances, decisions, and history.
 */

export const listDefinitions = async (spaceId) => {
  const response = await apiClient.get("/workflow/definitions", {
    params: { spaceId },
  });
  return response.data;
};

export const createDefinition = async (data) => {
  const response = await apiClient.post("/workflow/definitions", data);
  return response.data;
};

export const updateDefinition = async (id, data) => {
  const response = await apiClient.patch(`/workflow/definitions/${id}`, data);
  return response.data;
};

export const startWorkflow = async (data) => {
  const response = await apiClient.post("/workflow/start", data);
  return response.data;
};

export const getPending = async (spaceId, params = {}) => {
  const response = await apiClient.get("/workflow/pending", {
    params: { spaceId, ...params },
  });
  return response.data;
};

export const getMyRequests = async (spaceId, params = {}) => {
  const response = await apiClient.get("/workflow/my-requests", {
    params: { spaceId, ...params },
  });
  return response.data;
};

export const getInstance = async (id) => {
  const response = await apiClient.get(`/workflow/instances/${id}`);
  return response.data;
};

export const approve = async (id, note) => {
  const response = await apiClient.post(`/workflow/instances/${id}/approve`, { note });
  return response.data;
};

export const reject = async (id, note) => {
  const response = await apiClient.post(`/workflow/instances/${id}/reject`, { note });
  return response.data;
};

export const cancel = async (id) => {
  await apiClient.delete(`/workflow/instances/${id}`);
};

export default {
  listDefinitions,
  createDefinition,
  updateDefinition,
  startWorkflow,
  getPending,
  getMyRequests,
  getInstance,
  approve,
  reject,
  cancel,
};
