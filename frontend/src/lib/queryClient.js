import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { showToastBridge } from "../context/ToastContext";

/**
 * Extract a human-readable error message from an axios error or generic Error.
 */
function extractErrorMessage(error) {
  // Axios error with backend response
  const serverMsg =
    error?.response?.data?.message ||
    error?.response?.data?.error;
  if (serverMsg) {
    if (typeof serverMsg === 'string') return serverMsg;
    if (Array.isArray(serverMsg)) return serverMsg.join(', ');
    if (typeof serverMsg === 'object') {
      return serverMsg.message || JSON.stringify(serverMsg);
    }
    return String(serverMsg);
  }

  // Generic JS error
  if (error?.message) {
    if (typeof error.message === 'string') return error.message;
    return JSON.stringify(error.message);
  }

  return "An unexpected error occurred.";
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const status = error?.response?.status;

      // 401s are handled by the axios interceptor (redirect to /login).
      // 404s are usually expected (e.g. "task not found") and handled per-page.
      if (status === 401 || status === 404) return;

      // Only show a toast for queries that have already loaded data once
      // (background refetch failures). First-load errors are rendered in-page.
      if (query.state.data !== undefined) {
        showToastBridge(
          `Background refresh failed: ${extractErrorMessage(error)}`,
          "warning",
        );
      }
    },
  }),

  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const status = error?.response?.status;

      // 401s handled by interceptor
      if (status === 401) return;

      // If the mutation's options already define an onError, let that handle it.
      // This prevents double-toasting.
      if (mutation.options.onError) return;

      showToastBridge(extractErrorMessage(error), "error");
    },
  }),

  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on auth errors, not found, or method not allowed
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 404 || status === 405) return false;
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
});
