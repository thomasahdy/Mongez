import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
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
