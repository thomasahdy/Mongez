import { useQuery } from "@tanstack/react-query";
import searchService from "../../services/api/searchService";

/**
 * Custom Hook: useGlobalSearch
 * Queries the backend for unified search results.
 * 
 * @param {string} query - The search query term.
 * @param {string} spaceId - Space ID context for tenant isolation.
 * @param {Object} [options] - Additional filters or pagination parameters.
 * @returns {QueryResult} The react-query result payload.
 */
export function useGlobalSearch(query, spaceId, options = {}) {
  return useQuery({
    queryKey: ["search", query, spaceId, options],
    queryFn: () => searchService.globalSearch(query, spaceId, options),
    enabled: Boolean(query?.trim() && spaceId),
  });
}
