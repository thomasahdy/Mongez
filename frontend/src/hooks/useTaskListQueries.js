import { useQuery } from "@tanstack/react-query";
import tasksService from "../services/api/tasksService";

export function useBoardTasksQuery(boardId) {
  return useQuery({
    queryKey: ["board", "tasks", boardId],
    queryFn: () => tasksService.getBoardTasks(boardId),
    enabled: Boolean(boardId),
  });
}


// @IsString() columnId: string;
// @IsInt() @Min(0) position: number;    // target position within column

export function useMoveTaskQuery(boardId) {
  return useQuery({
    queryKey: ["board", "moveTask", boardId],
    queryFn: () => tasksService.moveTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", "tasks", boardId] });
    }
  });
}