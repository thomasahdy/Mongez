import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import billingService from "../services/api/billingService";
import calendarService from "../services/api/calendarService";
import analyticsService from "../services/api/analyticsService";
import boardsService from "../services/api/boardsService";
import tasksService from "../services/api/tasksService";
import { toArrayPayload } from "../services/api/responseUtils";
import { invalidateTaskCaches } from "../utils/queryInvalidation";

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
      const now = new Date();
      const upcomingWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
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
        upcomingDeadlines,
      ] = await Promise.all([
        analyticsService.getDashboardStats(spaceId).catch(() => ({})),
        analyticsService.getDashboardActivity(spaceId).catch(() => []),
        analyticsService.getDashboardTaskCompletion(spaceId).catch(() => []),
        analyticsService.getDashboardPriorityBreakdown(spaceId).catch(() => []),
        analyticsService.getDashboardTeamLoad(spaceId).catch(() => []),
        analyticsService.getExecutiveMetrics(spaceId).catch(() => ({})),
        analyticsService.getSlaMetrics(spaceId).catch(() => ({})),
        analyticsService.getWorkflowAnalytics(spaceId).catch(() => ({})),
        analyticsService.getApproverPerformance(spaceId).catch(() => []),
        tasksService.searchTasks("", spaceId, { limit: 200 }).then((tasks) =>
          tasks
            .filter((task) => {
              if (!task?.dueDate) return false;
              const dueDate = new Date(task.dueDate);
              return !Number.isNaN(dueDate.getTime()) && dueDate >= now && dueDate <= upcomingWindow && task.status !== "DONE" && task.status !== "CANCELLED";
            })
            .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
            .slice(0, 5)
            .map((task) => ({
              id: task.id,
              date: task.dueDate,
              title: task.title,
              status: task.status,
            })),
        ).catch(() => []),
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
        upcomingDeadlines,
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
    onSuccess: () => {
      invalidateTaskCaches(queryClient);
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
        calendarEvents: toArrayPayload(calendarPayload, ["data", "events", "items"]),
      };
    },
    enabled: Boolean(boardId),
  });
}
