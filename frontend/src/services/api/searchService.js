import apiClient from "./apiClient";

/**
 * Perform a global search across tasks, approvals, files, and comments in a workspace.
 * 
 * @param {string} query - The search query term.
 * @param {string} spaceId - Space ID context for tenant isolation.
 * @param {Object} [options] - Additional parameters (types, status, etc.).
 * @returns {Promise<Object>} Object containing arrays of matching entities.
 */
export const globalSearch = async (query, spaceId, options = {}) => {
  const { data } = await apiClient.get("/search", {
    params: {
      q: query,
      spaceId,
      ...options,
    },
  });
  return data;
};

const searchService = {
  globalSearch,
};

export default searchService;
