import { useQuery } from '@tanstack/react-query';
import analyticsService from '../../services/api/analyticsService';

export const useDashboardStats = (spaceId, period = "month") => {
  return useQuery({
    queryKey: ['SpaceAnalytics', spaceId, 'stats', period],
    queryFn: () => analyticsService.getDashboardStats(spaceId, period),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  })
}

export const useCompletion = (spaceId, period = "month") => {
  return useQuery({
    queryKey: ["SpaceAnalytics", spaceId, "task-completion", period],
    queryFn: () => analyticsService.getDashboardTaskCompletion(spaceId, period),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  });
};

export const usePriorityBreakdown = (spaceId, period = "month") => {
  return useQuery({
    queryKey: ["SpaceAnalytics", spaceId, "priority-breakdown", period],
    queryFn: async () => {
      const data = await analyticsService.getDashboardPriorityBreakdown(spaceId, period);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCumulativeFlow = (spaceId, period = "month") => {
  return useQuery({
    queryKey: ["SpaceAnalytics", spaceId, "cumulative-flow", period],
    queryFn: () => analyticsService.getDashboardFlow(spaceId, period),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useTopPerformers = (spaceId, period = "month") => {
  return useQuery({
    queryKey: ["SpaceAnalytics", spaceId, "top-performers", period],
    queryFn: () => analyticsService.getDashboardPerformers(spaceId, period),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useAiInsights = (spaceId, period = "month") => {
  return useQuery({
    queryKey: ["SpaceAnalytics", spaceId, "ai-insights", period],
    queryFn: () => analyticsService.getDashboardInsights(spaceId, period),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  });
};
