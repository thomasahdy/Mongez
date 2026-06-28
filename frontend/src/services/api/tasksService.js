import apiClient from "./apiClient";
import { normalizeTask, normalizeTaskList } from "../../lib/taskMappers";
import { toArrayPayload, toPagedPayload } from "./responseUtils";

/**
 * Tasks API Service
 * Maps backend routes for task creation, filtering, searches, comments, and logging work times.
 */

/**
 * Create a new task within a workspace space
 * @param {Object} data - Task creation payload
 * @param {string} data.title - Title of the task
 * @param {string} data.columnId - Target column ID
 * @param {string} data.spaceId - Space identifier
 * @param {string} [data.description] - Task description
 * @param {string[]} [data.assignees] - Array of assignee user IDs
 * @param {string} [data.dueDate] - ISO date string
 * @returns {Promise<Object>} Created task details
 */
export const createTask = async (data) => {
  const cleaned = { ...data };
  if (cleaned.dueDate === "") delete cleaned.dueDate;
  if (cleaned.startDate === "") delete cleaned.startDate;
  if (cleaned.parentId === "") delete cleaned.parentId;
  if (cleaned.description === "") delete cleaned.description;
  if (cleaned.labels) delete cleaned.labels;

  if (cleaned.assignees) {
    cleaned.assigneeIds = cleaned.assignees;
    delete cleaned.assignees;
  }

  const response = await apiClient.post("/tasks", cleaned);
  return response.data;
};

/**
 * Fetch tasks for a board (supports filtering and pagination)
 * @param {string} boardId - Unique identifier of the board
 * @param {Object} [params] - Query filter parameters
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=10] - Page size limit
 * @param {string} [params.status] - Filter by task status
 * @param {string} [params.search] - Filter by keyword search
 * @returns {Promise<Object>} Paginated task list
 */
export const getBoardTasks = async (boardId, params = {}) => {
  const response = await apiClient.get(`/boards/${boardId}/tasks`, { params });
  return normalizeTaskList(response.data);
};

export const getBoardTasksPage = async (boardId, params = {}) => {
  const response = await apiClient.get(`/boards/${boardId}/tasks`, { params });
  const paged = toPagedPayload(response.data, ["data", "items", "tasks"]);

  return {
    ...paged,
    items: normalizeTaskList(paged.items),
  };
};

/**
 * Search tasks globally across the active space/organization
 * @param {string} query - Text query string
 * @param {string} spaceId - Space ID context
 * @param {Object} [params] - Pagination parameters
 * @returns {Promise<Object>} Paginated search results
 */
export const searchTasks = async (query, spaceId, params = {}) => {
  const response = await apiClient.get("/tasks/search", {
    params: {
      q: query,
      spaceId,
      ...params,
    },
  });
  return normalizeTaskList(response.data);
};

/**
 * Fetch detailed information for a single task by ID
 * @param {string} id - Task ID
 * @returns {Promise<Object>} Task details
 */
export const getTask = async (id) => {
  const response = await apiClient.get(`/tasks/${id}`);
  return normalizeTask(response.data);
};

/**
 * Update task properties (e.g. description, assignees, tags, title)
 * @param {string} id - Task ID
 * @param {Object} data - Updated task fields
 * @returns {Promise<Object>} Updated task details
 */
export const updateTask = async (id, data) => {
  const cleaned = { ...data };
  if (cleaned.assignees) {
    cleaned.assigneeIds = cleaned.assignees;
    delete cleaned.assignees;
  }
  const response = await apiClient.patch(`/tasks/${id}`, cleaned);
  return normalizeTask(response.data);
};

/**
 * Move a task to a different position or column on the board (optimistic update mapping)
 * @param {string} id - Task ID
 * @param {Object} data - Move instructions
 * @param {string} data.columnId - Target column ID
 * @param {number} data.position - 0-indexed position within the column
 * @returns {Promise<Object>} Updated task layout details
 */
export const moveTask = async (id, data) => {
  const response = await apiClient.patch(`/tasks/${id}/move`, data);
  return response.data;
};

/**
 * Soft delete (archive) a task
 * @param {string} id - Task ID
 * @returns {Promise<void>}
 */
export const archiveTask = async (id) => {
  await apiClient.delete(`/tasks/${id}`);
};

export const deleteTask = archiveTask;

export const createBoardTask = async (board, taskData) => {
  if (!board?.id) {
    throw new Error("Choose a board before creating a task.");
  }

  const firstColumn =
    board.columns?.find((column) => !column.isArchived) ||
    board.columns?.[0];

  const payload = {
    title: taskData.title,
    description: taskData.description || "",
    boardId: board.id,
    columnId: taskData.columnId || firstColumn?.id,
    spaceId: board.spaceId || taskData.spaceId,
    spacePrefix: board.space?.prefix || board.spacePrefix || taskData.spacePrefix,
    priority: taskData.priority || "MEDIUM",
    type: taskData.type || "Task",
    tags: taskData.tags || [],
  };

  if (taskData.assigneeIds && taskData.assigneeIds.length > 0) {
    payload.assigneeIds = taskData.assigneeIds;
  } else if (taskData.assigneeId) {
    payload.assigneeIds = [taskData.assigneeId];
  }

  if (taskData.dueDate && taskData.dueDate !== "") {
    payload.dueDate = new Date(taskData.dueDate).toISOString();
  }
  if (taskData.startDate && taskData.startDate !== "") {
    payload.startDate = new Date(taskData.startDate).toISOString();
  }
  if (taskData.estimatedHours) {
    payload.estimatedHours = Number(taskData.estimatedHours);
  }
  if (taskData.parentId && taskData.parentId !== "") {
    payload.parentId = taskData.parentId;
  }

  return createTask(payload);
};

/**
 * Add a comment to a task
 * @param {string} id - Task ID
 * @param {Object} data - Comment payload
 * @param {string} data.content - Comment text content
 * @returns {Promise<Object>} Created comment details
 */
export const addComment = async (id, data) => {
  const response = await apiClient.post(`/tasks/${id}/comments`, data);
  return response.data;
};

/**
 * Fetch comments for a task (paginated)
 * @param {string} id - Task ID
 * @param {Object} [params] - Pagination parameters
 * @returns {Promise<Object>} Paginated comment listings
 */
export const getComments = async (id, params = {}) => {
  const response = await apiClient.get(`/tasks/${id}/comments`, { params });
  return toPagedPayload(response.data, ["data", "items", "comments"]);
};

/**
 * Edit a user's own comment
 * @param {string} id - Task ID
 * @param {string} commentId - Comment ID
 * @param {Object} data - Updated comment fields
 * @returns {Promise<Object>} Updated comment details
 */
export const updateComment = async (id, commentId, data) => {
  const response = await apiClient.patch(`/tasks/${id}/comments/${commentId}`, data);
  return response.data;
};

/**
 * Delete a user's own comment
 * @param {string} id - Task ID
 * @param {string} commentId - Comment ID
 * @returns {Promise<void>}
 */
export const deleteComment = async (id, commentId) => {
  await apiClient.delete(`/tasks/${id}/comments/${commentId}`);
};

/**
 * Log work hours spent on a task
 * @param {string} id - Task ID
 * @param {Object} data - Time log payload
 * @param {number} data.duration - Duration in seconds or minutes
 * @param {string} [data.description] - Optional description of work
 * @returns {Promise<Object>} Created time log details
 */
export const logTime = async (id, data) => {
  const response = await apiClient.post(`/tasks/${id}/time-logs`, data);
  return response.data;
};

/**
 * Fetch work log history for a task
 * @param {string} id - Task ID
 * @returns {Promise<Array>} List of logged times
 */
export const getTimeLogs = async (id) => {
  const response = await apiClient.get(`/tasks/${id}/time-logs`);
  return toArrayPayload(response.data, ["data", "items", "timeLogs"]);
};

export const getTaskFiles = async (id, params = {}) => {
  const response = await apiClient.get(`/tasks/${id}/files`, { params });
  return toArrayPayload(response.data, ["data", "items", "files", "attachments"]);
};

export const uploadTaskAttachment = async (id, file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post(`/tasks/${id}/files`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getMyWorkTasks = async () => {
  const response = await apiClient.get("/tasks/me/assigned");
  return response.data;
};

export const deleteTaskFile = async (fileId) => {
  await apiClient.delete(`/files/${fileId}`);
};

const tasksService = {
  createTask,
  getBoardTasks,
  getBoardTasksPage,
  searchTasks,
  getTask,
  updateTask,
  moveTask,
  archiveTask,
  deleteTask,
  createBoardTask,
  addComment,
  getComments,
  updateComment,
  deleteComment,
  logTime,
  getTimeLogs,
  getTaskFiles,
  uploadTaskAttachment,
  getMyWorkTasks,
  deleteTaskFile,
};

export default tasksService;
