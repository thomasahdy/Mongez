import { useQuery } from "@tanstack/react-query";
import { getBoardTasks } from "../lib/pageApi";
import { normalizeTaskList } from "../lib/taskMappers";

export function useBoardTasksQuery(boardId) {
  return useQuery({
    queryKey: ["board", "tasks", boardId],
    queryFn: async () => {
      const payload = await getBoardTasks(boardId);
      return Array.isArray(payload) ? payload : normalizeTaskList(payload);
    },
    enabled: Boolean(boardId),
  });
}

