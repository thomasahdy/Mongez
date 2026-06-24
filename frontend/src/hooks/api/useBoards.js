import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import boardsService from '../../services/api/boardsService';

/**
 * Hook: useBoards
 * Fetches boards registered inside a department.
 * @param {string} deptId - Department ID
 * @param {Object} [params] - Pagination / filter query options
 */
export function useBoards(deptId, params = {}) {
  return useQuery({
    queryKey: ['boards', { deptId, ...params }],
    queryFn: () => boardsService.getDepartmentBoards(deptId, params),
    enabled: !!deptId,
  });
}

/**
 * Hook: useBoard
 * Fetches a single board's layout details (columns and task count).
 * @param {string} boardId - Board ID
 */
export function useBoard(boardId) {
  return useQuery({
    queryKey: ['boards', boardId],
    queryFn: () => boardsService.getBoard(boardId),
    enabled: !!boardId,
  });
}

/**
 * Hook: useCreateBoard
 * Mutation to create a board. On success, invalidates the department boards cache.
 */
export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => {
      console.log("useCreateBoard mutationFn called with:", data);
      return boardsService.createBoard(data);
    },
    onSuccess: (newBoard) => {
      console.log("useCreateBoard onSuccess:", newBoard);
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      queryClient.setQueryData(['boards', newBoard.id], newBoard);
    },
    onError: (error) => {
      console.error("useCreateBoard onError:", error);
    },
  });
}

/**
 * Hook: useUpdateBoard
 * Mutation to edit board details. Optimistically updates the board cache.
 */
export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, data }) => boardsService.updateBoard(boardId, data),
    onMutate: async ({ boardId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['boards', boardId] });
      const previousBoard = queryClient.getQueryData(['boards', boardId]);

      queryClient.setQueryData(['boards', boardId], (old) => ({
        ...old,
        ...data,
      }));

      return { previousBoard };
    },
    onError: (err, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['boards', context.previousBoard.id], context.previousBoard);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

/**
 * Hook: useReorderColumns
 * Mutation to save new column sorting. Invalidates the active board.
 */
export function useReorderColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, columnIds }) => boardsService.reorderColumns(boardId, { columnIds }),
    onSuccess: (_, { boardId }) => {
      queryClient.invalidateQueries({ queryKey: ['boards', boardId] });
    },
  });
}
