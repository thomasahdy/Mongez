import { apiRequest } from "./apiClient";
import { normalizeTask, normalizeTaskList } from "./taskMappers";

function normalizePagedItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.logs)) {
    return payload.logs;
  }

  return [];
}

export async function getSpaces() {
  const payload = await apiRequest("/spaces");
  return normalizePagedItems(payload);
}

export async function createSpace(body) {
  return apiRequest("/spaces", {
    method: "POST",
    body,
  });
}

export async function getSpace(spaceId) {
  return apiRequest(`/spaces/${spaceId}`);
}

export async function updateSpace(spaceId, body) {
  return apiRequest(`/spaces/${spaceId}`, {
    method: "PATCH",
    body,
  });
}

export async function deleteSpace(spaceId) {
  return apiRequest(`/spaces/${spaceId}`, {
    method: "DELETE",
  });
}

export async function setActiveSpaceSession(spaceId) {
  return apiRequest("/spaces/active", {
    method: "POST",
    body: { spaceId },
  });
}

export async function getSpaceStats(spaceId) {
  return apiRequest(`/spaces/${spaceId}/stats`);
}

export async function getSpaceDepartments(spaceId) {
  return apiRequest(`/spaces/${spaceId}/departments`);
}

export async function getSpaceMembers(spaceId) {
  return apiRequest(`/spaces/${spaceId}/members`);
}

export async function inviteSpaceMember(spaceId, body) {
  return apiRequest(`/spaces/${spaceId}/invitations`, {
    method: "POST",
    body,
  });
}

export async function getSpaceInvitations(spaceId) {
  return apiRequest(`/spaces/${spaceId}/invitations`);
}

export async function revokeSpaceInvitation(spaceId, inviteId) {
  return apiRequest(`/spaces/${spaceId}/invitations/${inviteId}`, {
    method: "DELETE",
  });
}

export async function updateSpaceMemberRole(spaceId, userId, role) {
  return apiRequest(`/spaces/${spaceId}/members/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export async function removeSpaceMember(spaceId, userId) {
  return apiRequest(`/spaces/${spaceId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function leaveSpace(spaceId) {
  return apiRequest(`/spaces/${spaceId}/members/me`, {
    method: "DELETE",
  });
}

export async function getDepartmentBoards(departmentId) {
  const payload = await apiRequest(`/departments/${departmentId}/boards`);
  return normalizePagedItems(payload);
}

export async function createBoard(body) {
  return apiRequest("/boards", {
    method: "POST",
    body,
  });
}

export async function getBoard(boardId) {
  return apiRequest(`/boards/${boardId}`);
}

export async function updateBoard(boardId, body) {
  return apiRequest(`/boards/${boardId}`, {
    method: "PATCH",
    body,
  });
}

export async function deleteBoard(boardId) {
  return apiRequest(`/boards/${boardId}`, {
    method: "DELETE",
  });
}

export async function getBoardTasks(boardId, filters = {}) {
  const payload = await apiRequest(`/boards/${boardId}/tasks`, { params: filters });
  return normalizeTaskList(payload);
}

export async function getBoardTasksPage(boardId, filters = {}) {
  const payload = await apiRequest(`/boards/${boardId}/tasks`, {
    params: filters,
    unwrap: false,
  });
  const body = payload?.data || payload || {};

  return {
    items: normalizeTaskList(body),
    total: Number(body?.pagination?.total ?? body?.total ?? 0) || 0,
    page: Number(body?.pagination?.page ?? body?.page ?? filters.page ?? 1) || 1,
    limit: Number(body?.pagination?.limit ?? body?.limit ?? filters.limit ?? 20) || 20,
  };
}

export async function createBoardTask(board, taskData) {
  if (!board?.id) {
    throw new Error("Choose a board before creating a task.");
  }

  const firstColumn =
    board.columns?.find((column) => !column.isArchived) ||
    board.columns?.[0];

  const payload = await apiRequest("/tasks", {
    method: "POST",
    body: {
      title: taskData.title,
      description: taskData.description || "",
      boardId: board.id,
      columnId: taskData.columnId || firstColumn?.id,
      spaceId: board.spaceId,
      spacePrefix: board.space?.prefix || board.spacePrefix,
      priority: taskData.priority || "MEDIUM",
      assigneeId: taskData.assigneeId,
      dueDate: taskData.dueDate,
      labels: taskData.labels || [],
    },
  });

  return normalizeTask(payload);
}

export async function getTask(taskId) {
  const payload = await apiRequest(`/tasks/${taskId}`);
  return normalizeTask(payload);
}

export async function updateTask(taskId, updates) {
  const payload = await apiRequest(`/tasks/${taskId}`, {
    method: "PATCH",
    body: updates,
  });

  return normalizeTask(payload);
}

export async function deleteTask(taskId) {
  return apiRequest(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function assignTask(taskId, assigneeId) {
  throw new Error(`Task assignee updates are not exposed by the current backend API for task ${taskId}${assigneeId ? "" : ""}.`);
}

export async function uploadTaskAttachment(taskId, file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest(`/tasks/${taskId}/attachments`, {
    method: "POST",
    body: formData,
  });
}

export async function getTaskComments(taskId, params = {}) {
  const payload = await apiRequest(`/tasks/${taskId}/comments`, { params });
  return normalizePagedItems(payload);
}

export async function createTaskComment(taskId, body) {
  return apiRequest(`/tasks/${taskId}/comments`, {
    method: "POST",
    body,
  });
}

export async function getTaskTimeLogs(taskId) {
  return apiRequest(`/tasks/${taskId}/time-logs`);
}

export async function getTaskFiles(taskId) {
  return apiRequest(`/tasks/${taskId}/files`);
}

export async function searchTasks(params) {
  const payload = await apiRequest("/tasks/search", { params });
  return normalizeTaskList(payload);
}

export async function getDashboardStats(spaceId) {
  const [overview, stats] = await Promise.allSettled([
    apiRequest("/analytics/overview", {
      params: { spaceId },
      unwrap: false,
    }),
    getSpaceStats(spaceId),
  ]);

  return {
    ...(overview.status === "fulfilled" ? overview.value?.data || overview.value || {} : {}),
    ...(stats.status === "fulfilled" ? stats.value || {} : {}),
  };
}

export async function getDashboardActivity(spaceId) {
  const payload = await apiRequest(`/spaces/${spaceId}/audit-logs`, {
    params: { spaceId, limit: 6 },
    unwrap: false,
  });

  return normalizePagedItems(payload?.data || payload);
}

export async function getDashboardTaskCompletion(spaceId) {
  const payload = await apiRequest("/analytics/tasks", {
    params: { spaceId, period: "month" },
    unwrap: false,
  });

  return normalizePagedItems(payload?.data || payload);
}

export async function getDashboardPriorityBreakdown(spaceId) {
  const tasks = await searchTasks({ spaceId, q: "", limit: 100 });
  const counts = tasks.reduce((accumulator, task) => {
    const key = task.priority || "MEDIUM";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
  }));
}

export async function getDashboardTeamLoad(spaceId) {
  const payload = await apiRequest("/analytics/team", {
    params: { spaceId, period: "month" },
    unwrap: false,
  });

  return normalizePagedItems(payload?.data || payload);
}

export async function getExecutiveMetrics(spaceId) {
  const payload = await apiRequest("/analytics/executive", {
    params: { spaceId },
    unwrap: false,
  });

  return payload?.data || payload || {};
}

export async function getSlaMetrics(spaceId) {
  const payload = await apiRequest("/analytics/sla", {
    params: { spaceId },
    unwrap: false,
  });

  return payload?.data || payload || {};
}

export async function getWorkflowAnalytics(spaceId) {
  const payload = await apiRequest("/analytics/workflows", {
    params: { spaceId },
    unwrap: false,
  });

  return payload?.data || payload || {};
}

export async function getApproverPerformance(spaceId) {
  const payload = await apiRequest("/analytics/approvers", {
    params: { spaceId },
    unwrap: false,
  });

  return normalizePagedItems(payload?.data || payload);
}
