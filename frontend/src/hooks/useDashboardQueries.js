import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import billingService from "../services/api/billingService";
import calendarService from "../services/api/calendarService";
import analyticsService from "../services/api/analyticsService";
import boardsService from "../services/api/boardsService";
import tasksService from "../services/api/tasksService";

function normalizeCalendarItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.events)) {
    return payload.events;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

export function useBillingQuery(spaceId) {
  return useQuery({
    queryKey: ["dashboard", "billing", spaceId],
    queryFn: () => billingService.getSpaceBilling(spaceId),
    enabled: Boolean(spaceId),
  });
}

export function useDashboardAnalyticsQuery(spaceId) {
  return useQuery({
    queryKey: ["dashboard", "analytics", spaceId],
    queryFn: async () => {
      const [
        stats,
        activity,
        completion,
        priority,
        teamLoad,
        executiveMetrics,
        slaMetrics,
        workflowAnalytics,
        approverPerformance,
      ] = await Promise.all([
        analyticsService.getDashboardStats(spaceId),
        analyticsService.getDashboardActivity(spaceId),
        analyticsService.getDashboardTaskCompletion(spaceId),
        analyticsService.getDashboardPriorityBreakdown(spaceId),
        analyticsService.getDashboardTeamLoad(spaceId),
        analyticsService.getExecutiveMetrics(spaceId).catch(() => ({})),
        analyticsService.getSlaMetrics(spaceId).catch(() => ({})),
        analyticsService.getWorkflowAnalytics(spaceId).catch(() => ({})),
        analyticsService.getApproverPerformance(spaceId).catch(() => []),
      ]);

      return {
        stats,
        activity,
        completion,
        priority,
        teamLoad,
        executiveMetrics,
        slaMetrics,
        workflowAnalytics,
        approverPerformance,
      };
    },
    enabled: Boolean(spaceId),
  });
}

export function useBoardTableQuery(boardId, filters) {
  return useQuery({
    queryKey: ["board", "table", boardId, filters],
    queryFn: async () => {
      const [board, pagedTasks] = await Promise.all([
        boardsService.getBoard(boardId),
        tasksService.getBoardTasksPage(boardId, filters),
      ]);

      return {
        board,
        ...pagedTasks,
      };
    },
    enabled: Boolean(boardId),
  });
}

export function useCreateBoardTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ board, taskData }) => tasksService.createBoardTask(board, taskData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["board", "table"] });
      queryClient.invalidateQueries({ queryKey: ["board", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["board", "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["task", "details"] });
      queryClient.invalidateQueries({ queryKey: ["calendar", "events"] });
    },
  });
}

export function useTimelineQuery({ boardId, spaceId, startDate, endDate }) {
  return useQuery({
    queryKey: ["board", "timeline", boardId, spaceId, startDate, endDate],
    queryFn: async () => {
      const [taskPayload, calendarPayload] = await Promise.all([
        tasksService.getBoardTasks(boardId),
        spaceId
          ? calendarService.fetchCalendarEvents({
              spaceId,
              startDate,
              endDate,
              sources: ["tasks", "events"],
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      return {
        tasks: Array.isArray(taskPayload) ? taskPayload : [],
        calendarEvents: normalizeCalendarItems(calendarPayload),
      };
    },
    enabled: Boolean(boardId),
  });
}
