import apiClient from "./apiClient";

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
  const response = await apiClient.post("/tasks", data);
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
  return response.data;
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
  return response.data;
};

/**
 * Fetch detailed information for a single task by ID
 * @param {string} id - Task ID
 * @returns {Promise<Object>} Task details
 */
export const getTask = async (id) => {
  const response = await apiClient.get(`/tasks/${id}`);
  return response.data;
};

/**
 * Update task properties (e.g. description, assignees, tags, title)
 * @param {string} id - Task ID
 * @param {Object} data - Updated task fields
 * @returns {Promise<Object>} Updated task details
 */
export const updateTask = async (id, data) => {
  const response = await apiClient.patch(`/tasks/${id}`, data);
  return response.data;
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
  return response.data;
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
  return response.data;
};

const tasksService = {
  createTask,
  getBoardTasks,
  searchTasks,
  getTask,
  updateTask,
  moveTask,
  archiveTask,
  addComment,
  getComments,
  updateComment,
  deleteComment,
  logTime,
  getTimeLogs,
};

export default tasksService;
