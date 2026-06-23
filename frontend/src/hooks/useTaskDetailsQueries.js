import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import tasksService from "../services/api/tasksService";
import aiService from "../services/api/aiService";
import { toArrayPayload } from "../services/api/responseUtils";

export function useTaskDetailsQuery(taskId) {
  return useQuery({
    queryKey: ["task", "details", taskId],
    queryFn: async () => {
      const task = await tasksService.getTask(taskId);
      const [comments, files, timeLogs, risk] = await Promise.all([
        tasksService.getComments(taskId).catch(() => ({ items: [] })),
        tasksService.getTaskFiles(taskId).catch(() => []),
        tasksService.getTimeLogs(taskId).catch(() => []),
        aiService.analyzeRisk({
          spaceId: task.spaceId,
          boardId: task.boardId,
          taskId,
        }).catch(() => null),
      ]);

      return {
        task,
        comments: toArrayPayload(comments, ["items", "data", "comments"]),
        files,
        timeLogs,
        risk,
      };
    },
    enabled: Boolean(taskId),
  });
}

export function useTaskUpdateMutation(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates) => tasksService.updateTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}

export function useTaskCommentMutation(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => tasksService.addComment(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}

export function useTaskUploadMutation(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file) => tasksService.uploadTaskAttachment(taskId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}

export function useTaskDeleteMutation(taskId) {
  return useMutation({
    mutationFn: () => tasksService.deleteTask(taskId),
  });
}
