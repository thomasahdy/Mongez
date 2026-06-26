import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import tasksService from '../../services/api/tasksService';

/**
 * Hook: useTasks
 * Fetches all tasks associated with a board, support query filters.
 * @param {string} boardId - Unique board identifier
 * @param {Object} [filters] - Pagination, search, or status filters
 */
export function useTasks(boardId, filters = {}) {
  return useQuery({
    queryKey: ['tasks', { boardId, ...filters }],
    queryFn: () => tasksService.getBoardTasks(boardId, filters),
    enabled: !!boardId,
  });
}

/**
 * Hook: useTask
 * Fetches full description, comments, assignees, and time logs of a single task.
 * @param {string} id - Task ID
 */
export function useTask(id) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksService.getTask(id),
    enabled: !!id,
  });
}

/**
 * Hook: useCreateTask
 * Mutation to add a new task card. Invalidates active board tasks list on success.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    // mutationFn accepts a single object, which we destructure into board and taskData
    mutationFn: ({ board, taskData }) => tasksService.createBoardTask(board, taskData),
    
    onSuccess: (newTask) => {
      // Safely updates lists viewing this board's tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      // If your board state caches tasks inside it, invalidate the board too
      if (newTask?.boardId) {
        queryClient.invalidateQueries({ queryKey: ['boards', newTask.boardId] });
      }
    },
    onError: (error) => {
      console.error("Failed to create task:", error);
    }
  });
}

/**
 * Hook: useUpdateTask
 * Mutation to edit task fields. Optimistically updates target task details.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }) => tasksService.updateTask(taskId, data),
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', taskId] });
      const previousTask = queryClient.getQueryData(['tasks', taskId]);

      queryClient.setQueryData(['tasks', taskId], (old) => ({
        ...old,
        ...data,
      }));

      return { previousTask };
    },
    onError: (err, variables, context) => {
      if (context?.previousTask) {
        queryClient.setQueryData(['tasks', context.previousTask.id], context.previousTask);
      }
    },
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Hook: useMoveTask
 * Mutation to update task column position (optimistic card shifting for drag-drop).
 * Standardizes cache reordering before API response to guarantee smooth UI feel.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, columnId, position }) =>
      tasksService.moveTask(taskId, { columnId, position }),
    onMutate: async ({ taskId, columnId, position, boardId, filters }) => {
      const queryKey = ['tasks', { boardId, ...filters }];
      
      // Cancel outgoing fetches so they don't overwrite optimistic cache
      await queryClient.cancelQueries({ queryKey });
      
      const previousTasksData = queryClient.getQueryData(queryKey);

      if (previousTasksData) {
        // Optimistically reorder list cache
        queryClient.setQueryData(queryKey, (old) => {
          if (!old || !Array.isArray(old.data)) return old;

          const updatedTasks = [...old.data];
          const taskIndex = updatedTasks.findIndex(t => t.id === taskId);
          
          if (taskIndex !== -1) {
            const [movedTask] = updatedTasks.splice(taskIndex, 1);
            movedTask.columnId = columnId;
            // Splice back at new index
            updatedTasks.splice(position, 0, movedTask);
          }

          return {
            ...old,
            data: updatedTasks,
          };
        });
      }

      return { previousTasksData, queryKey };
    },
    onError: (err, variables, context) => {
      // Revert cache to original layout if API move fails
      if (context?.previousTasksData) {
        queryClient.setQueryData(context.queryKey, context.previousTasksData);
      }
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: context.queryKey });
    },
  });
}
