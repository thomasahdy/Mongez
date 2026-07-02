import apiClient from "./apiClient";
import tasksService from "./tasksService";

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
    params: { spaceId, limit: 6 },
  });
  // Backend returns a raw array of audit logs; keep the paginated shapes as fallbacks.
  return (
    response.data?.data?.items ||
    response.data?.logs ||
    (Array.isArray(response.data) ? response.data : [])
  );
};

export const getDashboardTaskCompletion = async (spaceId, period = "month") => {
  const response = await apiClient.get("/analytics/tasks", {
    params: { spaceId, period },
  });
  return response.data?.weeklyCompletion || [];
};

export const getDashboardPriorityBreakdown = async (spaceId) => {
  if (!spaceId) return [];
  // Try the analytics endpoint first for server-side aggregation
  try {
    const response = await apiClient.get('/analytics/tasks', {
      params: { spaceId, period: 'month', groupBy: 'priority' },
    });
    const items = response.data?.breakdown?.data?.items;
    if (Array.isArray(items) && items.length > 0) {
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
  return response.data?.members || [];
};

export const getExecutiveMetrics = async (spaceId) => {
  const response = await apiClient.get("/analytics/executive", { params: { spaceId } });
  return response.data || {};
};

export const getSlaMetrics = async (spaceId) => {
  const response = await apiClient.get("/analytics/approvals", { params: { spaceId } });
  return response.data || {};
};

export const getWorkflowAnalytics = async (spaceId) => {
  const response = await apiClient.get("/analytics/workflows", { params: { spaceId } });
  return response.data || {};
};

export const getApproverPerformance = async (spaceId) => {
  const response = await apiClient.get("/analytics/team", { params: { spaceId, role: "APPROVER" } });
  return response.data?.members || [];
};

export const getDashboardFlow = async (spaceId) => {
  const response = await apiClient.get("/analytics/flow", { params: { spaceId, period: "month" } });
  return response.data?.data?.items || [];
};

export const getDashboardPerformers = async (spaceId) => {
  const response = await apiClient.get("/analytics/performers", { params: { spaceId } });
  return response.data?.data?.items || [];
};

export const getDashboardInsights = async (spaceId) => {
  const response = await apiClient.get("/analytics/insights", { params: { spaceId } });
  return response.data?.data?.items || [];
};

const analyticsService = {
  getDashboardStats,
  getDashboardActivity,
  getDashboardTaskCompletion,
  getDashboardPriorityBreakdown,
  getDashboardTeamLoad,
  getDashboardFlow,
  getDashboardPerformers,
  getDashboardInsights,
  getExecutiveMetrics,
  getSlaMetrics,
  getWorkflowAnalytics,
  getApproverPerformance,
};

export default analyticsService;
