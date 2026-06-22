import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTaskComment,
  deleteTask,
  getTask,
  getTaskComments,
  getTaskFiles,
  getTaskTimeLogs,
  uploadTaskAttachment,
  updateTask,
} from "../lib/pageApi";
import { analyzeRisk } from "../lib/aiApi";

export function useTaskDetailsQuery(taskId) {
  return useQuery({
    queryKey: ["task", "details", taskId],
    queryFn: async () => {
      const task = await getTask(taskId);
      const [comments, files, timeLogs, risk] = await Promise.all([
        getTaskComments(taskId).catch(() => []),
        getTaskFiles(taskId).catch(() => []),
        getTaskTimeLogs(taskId).catch(() => []),
        analyzeRisk({
          spaceId: task.spaceId,
          boardId: task.boardId,
          taskId,
        }).catch(() => null),
      ]);

      return {
        task,
        comments,
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
    mutationFn: (updates) => updateTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}

export function useTaskCommentMutation(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createTaskComment(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}

export function useTaskUploadMutation(taskId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file) => uploadTaskAttachment(taskId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", "details", taskId] });
    },
  });
}

export function useTaskDeleteMutation(taskId) {
  return useMutation({
    mutationFn: () => deleteTask(taskId),
  });
}
