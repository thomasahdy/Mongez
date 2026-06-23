import { useQuery } from "@tanstack/react-query";
import tasksService from "../services/api/tasksService";

export function useBoardTasksQuery(boardId) {
  return useQuery({
    queryKey: ["board", "tasks", boardId],
    queryFn: () => tasksService.getBoardTasks(boardId),
    enabled: Boolean(boardId),
  });
}

