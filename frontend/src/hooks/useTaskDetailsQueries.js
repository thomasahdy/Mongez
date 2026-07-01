import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import tasksService from "../services/api/tasksService";
import aiService from "../services/api/aiService";
import { toArrayPayload } from "../services/api/responseUtils";
import { invalidateTaskCaches } from "../utils/queryInvalidation";

export function useTaskDetailsQuery(taskId) {
  return useQuery({
    queryKey: ["task", "details", taskId],
    queryFn: async () => {
      // Fetch task details, comments, files, driveFiles, time logs, and activities in parallel to eliminate waterfall
      const [task, comments, files, driveFiles, timeLogs, activities] = await Promise.all([
        tasksService.getTask(taskId),
        tasksService.getComments(taskId).catch(() => ({ items: [] })),
        tasksService.getTaskFiles(taskId).catch(() => []),
        tasksService.getTaskDriveFiles(taskId).catch(() => []),
        tasksService.getTimeLogs(taskId).catch(() => []),
        tasksService.getTaskActivity(taskId).catch(() => []),
      ]);

      // Fetch AI risk analysis with spaceId and boardId resolved from task
      const risk = await aiService.analyzeRisk({
        spaceId: task.board?.department?.spaceId,
        boardId: task.boardId,
        taskId,
      }).catch(() => null);

      return {
        task,
        comments: toArrayPayload(comments, ["items", "data", "comments"]),
        files,
        driveFiles,
        timeLogs,
        activities,
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
      invalidateTaskCaches(queryClient, { taskId });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tasksService.deleteTask(taskId),
    onSuccess: () => {
      invalidateTaskCaches(queryClient, { taskId });
    },
  });
}

export function useTaskAttachDriveFileMutation(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (driveFileId) => tasksService.attachDriveFile(taskId, driveFileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}

export function useTaskDeleteDriveFileMutation(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => tasksService.deleteDriveFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}
