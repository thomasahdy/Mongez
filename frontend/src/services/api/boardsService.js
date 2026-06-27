import apiClient from "./apiClient";
import { toPagedPayload } from "./responseUtils";

/**
 * Boards API Service
 * Maps backend routes for board operations, column definitions, and department lookups.
 */

/**
 * Create a new board (backend auto-creates 4 default columns: To Do, Waiting, In Progress, Done)
 * @param {Object} data - Board creation payload
 * @param {string} data.name - Name of the board
 * @param {string} data.departmentId - Department ID that the board belongs to
 * @param {string} data.type
 * @param {string} [data.description] - Board description
 * @returns {Promise<Object>} Created board details
 */
export const createBoard = async (data) => {
  const response = await apiClient.post("/boards", data);
  return response.data;
};

/**
 * Get board details by ID (includes columns and tasks)
 * @param {string} boardId - Unique identifier of the board
 * @returns {Promise<Object>} Board details
 */
export const getBoard = async (boardId) => {
  const response = await apiClient.get(`/boards/${boardId}`);
  return response.data;
};

/**
 * Update board details (e.g. rename or update type)
 * @param {string} boardId - Unique identifier of the board
 * @param {Object} data - Updated fields
 * @returns {Promise<Object>} Updated board details
 */
export const updateBoard = async (boardId, data) => {
  const response = await apiClient.patch(`/boards/${boardId}`, data);
  return response.data;
};

/**
 * Soft delete (archive) a board
 * @param {string} boardId - Unique identifier of the board
 * @returns {Promise<void>}
 */
export const archiveBoard = async (boardId) => {
  await apiClient.delete(`/boards/${boardId}`);
};

/**
 * Add a new column to a board
 * @param {string} boardId - Board ID
 * @param {Object} data - Column creation payload
 * @param {string} data.name - Column name
 * @param {string} [data.color] - Hex color code for indicators
 * @param {number} [data.wipLimit] - Work in progress limit
 * @param {number} [data.position] - position of the column in the board
 * @returns {Promise<Object>} Created column details
 */
export const addColumn = async (boardId, data) => {
  const response = await apiClient.post(`/boards/${boardId}/columns`, data);
  return response.data;
};

/**
 * Reorder board columns (drag-and-drop support)
 * Sends the full array of ordered column IDs to the backend.
 * @param {string} boardId - Board ID
 * @param {Object} data - Reorder payload
 * @param {string[]} data.columns - Ordered column objects with IDs and positions
 * @returns {Promise<Object>} Reordered board details
 */
export const reorderColumns = async (boardId, data) => {
  const response = await apiClient.patch(`/boards/${boardId}/columns/reorder`, data);
  return response.data;
};

/**
 * Update column details (name, color, wipLimit)
 * @param {string} boardId - Board ID
 * @param {string} colId - Column ID
 * @param {Object} data - Fields to update
 * @returns {Promise<Object>} Updated column details
 */
export const updateColumn = async (boardId, colId, data) => {
  const response = await apiClient.patch(`/boards/${boardId}/columns/${colId}`, data);
  return response.data;
};

/**
 * Soft delete/archive a column on a board
 * @param {string} boardId - Board ID
 * @param {string} colId - Column ID
 * @returns {Promise<void>}
 */
export const deleteColumn = async (boardId, colId) => {
  await apiClient.delete(`/boards/${boardId}/columns/${colId}`);
};

/**
 * Fetch all boards within a specific department (paginated)
 * @param {string} deptId - Unique identifier of the department
 * @param {Object} [params] - Pagination parameters
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=10] - Number of items per page
 * @returns {Promise<Object>} Paginated board listings
 */
export const getDepartmentBoards = async (deptId, params = {}) => {
  const response = await apiClient.get(`/departments/${deptId}/boards`, { params });
  return toPagedPayload(response.data, ["data", "items", "boards"]);
};

const boardsService = {
  createBoard,
  getBoard,
  updateBoard,
  archiveBoard,
  addColumn,
  reorderColumns,
  updateColumn,
  deleteColumn,
  getDepartmentBoards,
};

export default boardsService;
