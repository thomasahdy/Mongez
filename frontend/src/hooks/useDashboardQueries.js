import { useMutation, useQuery } from "@tanstack/react-query";
import { getSpaceBilling } from "../lib/billingApi";
import { fetchCalendarEvents } from "../lib/calendarApi";
import {
  createBoardTask,
  getApproverPerformance,
  getBoard,
  getBoardTasks,
  getBoardTasksPage,
  getDashboardActivity,
  getDashboardPriorityBreakdown,
  getDashboardStats,
  getDashboardTaskCompletion,
  getDashboardTeamLoad,
  getExecutiveMetrics,
  getSlaMetrics,
  getWorkflowAnalytics,
} from "../lib/pageApi";
import { normalizeTaskList } from "../lib/taskMappers";

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
    queryFn: () => getSpaceBilling(spaceId),
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
        getDashboardStats(spaceId),
        getDashboardActivity(spaceId),
        getDashboardTaskCompletion(spaceId),
        getDashboardPriorityBreakdown(spaceId),
        getDashboardTeamLoad(spaceId),
        getExecutiveMetrics(spaceId).catch(() => ({})),
        getSlaMetrics(spaceId).catch(() => ({})),
        getWorkflowAnalytics(spaceId).catch(() => ({})),
        getApproverPerformance(spaceId).catch(() => []),
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
        getBoard(boardId),
        getBoardTasksPage(boardId, filters),
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
  return useMutation({
    mutationFn: ({ board, taskData }) => createBoardTask(board, taskData),
  });
}

export function useTimelineQuery({ boardId, spaceId, startDate, endDate }) {
  return useQuery({
    queryKey: ["board", "timeline", boardId, spaceId, startDate, endDate],
    queryFn: async () => {
      const [taskPayload, calendarPayload] = await Promise.all([
        getBoardTasks(boardId),
        spaceId
          ? fetchCalendarEvents({
              spaceId,
              startDate,
              endDate,
              sources: ["tasks", "events"],
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      return {
        tasks: Array.isArray(taskPayload) ? taskPayload : normalizeTaskList(taskPayload),
        calendarEvents: normalizeCalendarItems(calendarPayload),
      };
    },
    enabled: Boolean(boardId),
  });
}
