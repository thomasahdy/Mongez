import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import membersService from '../../services/api/membersService';

/**
 * Custom Query Hook: useMembers
 * Retrieves the list of active members inside a workspace.
 * 
 * @param {string} spaceId - Unique space identifier
 */
export function useMembers(spaceId) {
  return useQuery({
    queryKey: ['members', spaceId],
    queryFn: () => membersService.getMembers(spaceId),
    enabled: !!spaceId,
  });
}

/**
 * Custom Query Hook: useInvites
 * Retrieves pending invitations that have not been accepted yet.
 * 
 * @param {string} spaceId - Unique space identifier
 */
export function useInvites(spaceId) {
  return useQuery({
    queryKey: ['invites', spaceId],
    queryFn: () => membersService.getPendingInvitations(spaceId),
    enabled: !!spaceId,
  });
}

/**
 * Custom Mutation Hook: useInviteMember
 * Sends an email invitation to a new user.
 */
export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, data }) => membersService.inviteMember(spaceId, data),
    onSuccess: (_, { spaceId }) => {
      // Invalidate members and invites list so UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['members', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['invites', spaceId] });
    },
  });
}

/**
 * Custom Mutation Hook: useUpdateMemberRole
 * Changes the workspace role of an existing space member.
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, userId, role }) => membersService.updateMemberRole(spaceId, userId, role),
    onSuccess: (_, { spaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['members', spaceId] });
    },
  });
}

/**
 * Custom Mutation Hook: useRemoveMember
 * Evicts/removes a member from a space.
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, userId }) => membersService.removeMember(spaceId, userId),
    onSuccess: (_, { spaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['members', spaceId] });
    },
  });
}

/**
 * Custom Mutation Hook: useCancelInvite
 * Cancels/revokes a pending invitation before it expires.
 */
export function useCancelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spaceId, inviteId }) => membersService.cancelInvitation(spaceId, inviteId),
    onSuccess: (_, { spaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['invites', spaceId] });
    },
  });
}
