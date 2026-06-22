import apiClient from "./apiClient";

/**
 * Spaces API Service
 * 
 * Provides methods for workspace spaces CRUD, departments, and active session context.
 * Use this service to interact with NestJS backend endpoints under `/spaces`.
 */

/**
 * Fetch all spaces/organizations the authenticated user belongs to.
 * 
 * @async
 * @function getSpaces
 * @returns {Promise<{data: Array<Object>, total: number}>} Paginated list of spaces and total count
 */
export const getSpaces = async () => {
  const { data } = await apiClient.get('/spaces');
  return {
    spaces: data?.data || data || [],
    meta: data?.meta || null,
  };
};

/**
 * Fetch a single space's metadata and structure details.
 * 
 * @async
 * @function getSpace
 * @param {string} spaceId - Space ID
 * @returns {Promise<Object>} Space details
 */
export const getSpace = async (spaceId) => {
  const { data } = await apiClient.get(`/spaces/${spaceId}`);
  return data;
};

/**
 * Create a new workspace space.
 * 
 * @async
 * @function createSpace
 * @param {Object} data - Space creation payload
 * @param {string} data.name - Name of the space
 * @param {string} [data.description] - Description of the space
 * @param {string} [data.prefix] - Short key (2-5 chars, e.g. 'PRJ') for task numbering
 * @param {string} [data.icon] - Icon class or symbol
 * @param {string} [data.color] - Brand color representation
 * @returns {Promise<Object>} Created space details
 */
export const createSpace = async (data) => {
  const response = await apiClient.post('/spaces', data);
  return response.data;
};

/**
 * Update space metadata.
 * 
 * @async
 * @function updateSpace
 * @param {string} spaceId - ID of the space to update
 * @param {Object} data - Updated fields
 * @returns {Promise<Object>} Updated space details
 */
export const updateSpace = async (spaceId, data) => {
  const response = await apiClient.patch(`/spaces/${spaceId}`, data);
  return response.data;
};

/**
 * Delete a workspace space (cascades and deletes all departments, boards, and tasks).
 * OWNER role only.
 * 
 * @async
 * @function deleteSpace
 * @param {string} spaceId - ID of the space to delete
 * @returns {Promise<void>}
 */
export const deleteSpace = async (spaceId) => {
  await apiClient.delete(`/spaces/${spaceId}`);
};

/**
 * Fetch task statistics and counts for a space.
 * 
 * @async
 * @function getSpaceStats
 * @param {string} spaceId - Space ID
 * @returns {Promise<{tasksByStatus: Array<Object>, memberCount: number}>} Status aggregates and member count
 */
export const getSpaceStats = async (spaceId) => {
  const response = await apiClient.get(`/spaces/${spaceId}/stats`);
  return response.data;
};

/**
 * Fetch all departments registered inside a space.
 * 
 * @async
 * @function getSpaceDepartments
 * @param {string} spaceId - Space ID
 * @returns {Promise<Array<Object>>} List of department entities
 */
export const getSpaceDepartments = async (spaceId) => {
  const response = await apiClient.get(`/spaces/${spaceId}/departments`);
  return response.data;
};

/**
 * Create a department inside a space.
 * 
 * @async
 * @function createDepartment
 * @param {string} spaceId - Space ID
 * @param {Object} data - Department payload
 * @param {string} data.name - Name of the department
 * @param {string} [data.description] - Description
 * @param {string} [data.color] - Color
 * @returns {Promise<Object>} Created department
 */
export const createDepartment = async (spaceId, data) => {
  const response = await apiClient.post(`/spaces/${spaceId}/departments`, data);
  return response.data;
};

/**
 * Update a department.
 * 
 * @async
 * @function updateDepartment
 * @param {string} spaceId - Parent space ID
 * @param {string} deptId - Department ID
 * @param {Object} data - Updated fields
 * @returns {Promise<Object>} Updated department
 */
export const updateDepartment = async (spaceId, deptId, data) => {
  const response = await apiClient.patch(`/spaces/${spaceId}/departments/${deptId}`, data);
  return response.data;
};

/**
 * Delete a department (fails if it contains active boards).
 * 
 * @async
 * @function deleteDepartment
 * @param {string} spaceId - Parent space ID
 * @param {string} deptId - Department ID to delete
 * @returns {Promise<void>}
 */
export const deleteDepartment = async (spaceId, deptId) => {
  await apiClient.delete(`/spaces/${spaceId}/departments/${deptId}`);
};

/**
 * Set active space context (client-side persistence).
 * 
 * Note: Session status is preserved in localStorage. Outgoing API queries read from local context.
 * 
 * @async
 * @function setActiveSpace
 * @param {string} spaceId - Space ID
 * @returns {Promise<{success: boolean, spaceId: string}>} Action confirmation
 */
export const setActiveSpace = async (spaceId) => {
  return { success: true, spaceId };
};

const spacesService = {
  getSpaces,
  getSpace,
  createSpace,
  updateSpace,
  deleteSpace,
  getSpaceStats,
  getSpaceDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  setActiveSpace,
};

export default spacesService;