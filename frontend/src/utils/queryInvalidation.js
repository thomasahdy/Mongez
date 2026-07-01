const TASK_RELATED_QUERY_KEYS = [
  ["tasks"],
  ["board", "table"],
  ["board", "tasks"],
  ["board", "timeline"],
  ["calendar", "events"],
];

export function invalidateTaskCaches(queryClient, { taskId, extraQueryKeys = [] } = {}) {
  TASK_RELATED_QUERY_KEYS.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });

  queryClient.invalidateQueries({ queryKey: taskId ? ["task", "details", taskId] : ["task", "details"] });

  extraQueryKeys.filter(Boolean).forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}
