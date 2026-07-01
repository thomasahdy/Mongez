import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import spacesService from '../../services/api/spacesService';
import { readActiveSpaceId, removeActiveSpaceId, writeActiveSpaceId } from '../../utils/appStorageKeys';

/**
 * Custom Query Hook: useSpaces
 * Retrieves the list of workspaces the user is a member of.
 */
export function useSpaces() {
  return useQuery({
    queryKey: ['spaces'],
    queryFn: spacesService.getSpaces,
    staleTime: 5 * 60 * 1000, // 5 minutes (workspaces are stable)
  });
}

/**
 * Custom Query Hook: useSpace
 * Retrieves detailed metadata for a single workspace.
 * 
 * @param {string} spaceId - Space ID
 */
export function useSpace(spaceId) {
  return useQuery({
    queryKey: ['spaces', spaceId],
    queryFn: () => spacesService.getSpace(spaceId),
    enabled: !!spaceId,
  });
}

/**
 * Custom Mutation Hook: useSetActiveSpace
 * Sets the client-side active workspace ID.
 */
export function useSetActiveSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (spaceId) => spacesService.setActiveSpace(spaceId),
    onSuccess: (_, spaceId) => {
      writeActiveSpaceId(spaceId);
      // Invalidate queries to trigger re-fetch under the new space context
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

/**
 * Custom Mutation Hook: useCreateSpace
 * Creates a new workspace. Invalidates the list of workspaces on success.
 */
export function useCreateSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: spacesService.createSpace,
    onSuccess: (newSpace) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.setQueryData(['spaces', newSpace.id], newSpace);
    },
  });
}

/**
 * Custom Mutation Hook: useUpdateSpace
 * Edits space parameters. Updates local cache details optimistically.
 */
export function useUpdateSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, data }) => spacesService.updateSpace(spaceId, data),
    onMutate: async ({ spaceId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['spaces', spaceId] });
      const previousSpace = queryClient.getQueryData(['spaces', spaceId]);

      queryClient.setQueryData(['spaces', spaceId], (old) => ({
        ...old,
        ...data,
      }));

      return { previousSpace };
    },
    onError: (err, variables, context) => {
      if (context?.previousSpace) {
        queryClient.setQueryData(['spaces', context.previousSpace.id], context.previousSpace);
      }
    },
    onSuccess: (_, { spaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['spaces', spaceId] });
    },
  });
}

/**
 * Custom Mutation Hook: useDeleteSpace
 * Deletes a workspace. Reverts activeSpaceId if the deleted workspace was active.
 */
export function useDeleteSpace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: spacesService.deleteSpace,
    onSuccess: (_, spaceId) => {
      queryClient.removeQueries({ queryKey: ['spaces', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });

      // If active space was deleted, clear it or pick another one
      const activeId = readActiveSpaceId();
      if (activeId === spaceId) {
        removeActiveSpaceId();
      }
    },
  });
}

/**
 * Custom Query Hook: useSpaceStats
 * Retrieves status-based task metrics and total member counts for a space.
 * 
 * @param {string} spaceId - Space ID
 */
export function useSpaceStats(spaceId) {
  return useQuery({
    queryKey: ['spaces', spaceId, 'stats'],
    queryFn: () => spacesService.getSpaceStats(spaceId),
    enabled: !!spaceId,
  });
}

/**
 * Custom Query Hook: useSpaceDepartments
 * Retrieves departments registered inside a space.
 * 
 * @param {string} spaceId - Space ID
 */
export function useSpaceDepartments(spaceId) {
  return useQuery({
    queryKey: ['spaces', spaceId, 'departments'],
    queryFn: () => spacesService.getSpaceDepartments(spaceId),
    enabled: !!spaceId,
  });
}

/**
 * Custom Mutation Hook: useCreateDepartment
 * Creates a department inside a space.
 */
export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, data }) => spacesService.createDepartment(spaceId, data),
    onSuccess: (_, { spaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'departments'] });
    },
  });
}

/**
 * Custom Mutation Hook: useUpdateDepartment
 * Updates a department's details.
 */
export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, deptId, data }) => spacesService.updateDepartment(spaceId, deptId, data),
    onSuccess: (_, { spaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'departments'] });
    },
  });
}

/**
 * Custom Mutation Hook: useDeleteDepartment
 * Deletes a department (will fail if containing boards).
 */
export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, deptId }) => spacesService.deleteDepartment(spaceId, deptId),
    onSuccess: (_, { spaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['spaces', spaceId, 'departments'] });
    },
  });
}
