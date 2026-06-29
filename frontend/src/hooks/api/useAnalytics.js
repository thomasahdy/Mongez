import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import analyticsService from '../../services/api/analyticsService';

export const useDashboardStats = (spaceId)=>{
    return useQuery({
        queryKey:['SpaceAnalytics', spaceId, 'stats'],
        queryFn: ()=> analyticsService.getDashboardStats(spaceId),
        enabled: !!spaceId,
        staleTime: 1000 * 60 * 5,
    })

}


export const useCompletion = (spaceId) => {
  return useQuery({
    queryKey: ["SpaceAnalytics", spaceId, "task-completion"],
    queryFn: () => analyticsService.getDashboardTaskCompletion(spaceId),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  });
};

export const usePriorityBreakdown = (spaceId) => {
  return useQuery({
    queryKey: ["SpaceAnalytics", spaceId, "priority-breakdown"],
    queryFn: async () => {
      const data =
        await analyticsService.getDashboardPriorityBreakdown(spaceId);

      return Array.isArray(data) ? data : [];
    },
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 5,
  });
};