import apiClient from "./apiClient";
import tasksService from "./tasksService";
import { toArrayPayload } from "./responseUtils";

export const getDashboardStats = async (spaceId) => {
  const [overview, stats] = await Promise.allSettled([
    apiClient.get("/analytics/overview", { params: { spaceId } }),
    apiClient.get(`/spaces/${spaceId}/stats`),
  ]);

  return {
    ...(overview.status === "fulfilled" ? overview.value.data || {} : {}),
    ...(stats.status === "fulfilled" ? stats.value.data || {} : {}),
  };
};

export const getDashboardActivity = async (spaceId) => {
  const response = await apiClient.get(`/spaces/${spaceId}/audit-logs`, {
    params: { limit: 6 },
  });
  return toArrayPayload(response.data, ["data", "items", "logs"]);
};

export const getDashboardTaskCompletion = async (spaceId, period) => {
  const response = await apiClient.get("/analytics/tasks", {
    params: { spaceId, period: "month" },
  });
  return toArrayPayload(response.data, ["data", "items", "tasks"]);
};

export const getDashboardPriorityBreakdown = async (spaceId) => {
  if (!spaceId) return [];
  // Try the analytics endpoint first for server-side aggregation
  try {
    const response = await apiClient.get('/analytics/tasks', {
      params: { spaceId, period: 'month', groupBy: 'priority' },
    });
    const items = toArrayPayload(response.data, ['breakdown', 'data', 'items']);
    if (items.length > 0) {
      return items;
    }
  } catch {
    // Fall through to client-side counting if analytics endpoint fails
  }

  // Fallback: client-side task counting
  const tasks = await tasksService.searchTasks("", spaceId, { limit: 100 });
  const counts = tasks.reduce((accumulator, task) => {
    const key = task.priority || "MEDIUM";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).map(([label, count]) => ({ label, count }));
};

export const getDashboardTeamLoad = async (spaceId) => {
  const response = await apiClient.get("/analytics/team", {
    params: { spaceId, period: "month" },
  });
  return toArrayPayload(response.data, ["data", "items", "members"]);
};

export const getExecutiveMetrics = async (spaceId) => {
  const response = await apiClient.get("/analytics/overview", {
    params: { spaceId },
  });
  return response.data || {};
};

export const getSlaMetrics = async (spaceId) => {
  try {
    const response = await apiClient.get('/analytics/overview', { params: { spaceId } });
    return response.data || {};
  } catch {
    return {};
  }
};

export const getWorkflowAnalytics = async (spaceId) => {
  try {
    const response = await apiClient.get('/analytics/tasks', {
      params: { spaceId, period: 'month' },
    });
    return response.data || {};
  } catch {
    return {};
  }
};

export const getApproverPerformance = async (spaceId) => {
  const response = await apiClient.get("/analytics/approvals", {
    params: { spaceId, period: "month" },
  });
  return toArrayPayload(response.data, ["data", "items", "approvals"]);
};

const analyticsService = {
  getDashboardStats,
  getDashboardActivity,
  getDashboardTaskCompletion,
  getDashboardPriorityBreakdown,
  getDashboardTeamLoad,
  getExecutiveMetrics,
  getSlaMetrics,
  getWorkflowAnalytics,
  getApproverPerformance,
};

export default analyticsService;
