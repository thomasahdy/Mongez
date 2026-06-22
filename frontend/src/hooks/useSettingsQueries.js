import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectGoogleCalendar,
  disconnectGoogleDrive,
  getIntegrationStatuses,
  syncGoogleCalendar,
} from "../lib/integrationsApi";
import {
  getSpaceInvitations,
  getSpaceMembers,
  inviteSpaceMember,
  leaveSpace,
  removeSpaceMember,
  revokeSpaceInvitation,
  updateSpaceMemberRole,
} from "../lib/pageApi";

export function useIntegrationStatusesQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "integrations", spaceId || "global"],
    queryFn: () => getIntegrationStatuses(spaceId),
  });
}

export function useDisconnectGoogleDriveMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disconnectGoogleDrive(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "integrations", spaceId || "global"] });
    },
  });
}

export function useGoogleCalendarConnectMutation() {
  return useMutation({
    mutationFn: (spaceId) => connectGoogleCalendar(spaceId),
  });
}

export function useGoogleCalendarSyncMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncGoogleCalendar(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "integrations", spaceId || "global"] });
    },
  });
}

export function useSpaceMembersQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "members", spaceId],
    queryFn: () => getSpaceMembers(spaceId),
    enabled: Boolean(spaceId),
  });
}

export function useSpaceInvitationsQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "invitations", spaceId],
    queryFn: async () => {
      try {
        const data = await getSpaceInvitations(spaceId);
        return {
          items: Array.isArray(data) ? data : [],
          canViewInvitations: true,
        };
      } catch (error) {
        if (error?.status === 403) {
          return {
            items: [],
            canViewInvitations: false,
          };
        }

        throw error;
      }
    },
    enabled: Boolean(spaceId),
    retry: false,
  });
}

export function useInviteSpaceMemberMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => inviteSpaceMember(spaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "invitations", spaceId] });
    },
  });
}

export function useUpdateSpaceMemberRoleMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }) => updateSpaceMemberRole(spaceId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "members", spaceId] });
    },
  });
}

export function useRemoveSpaceMemberMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => removeSpaceMember(spaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "members", spaceId] });
    },
  });
}

export function useRevokeSpaceInvitationMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId) => revokeSpaceInvitation(spaceId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "invitations", spaceId] });
    },
  });
}

export function useLeaveSpaceMutation(spaceId) {
  return useMutation({
    mutationFn: () => leaveSpace(spaceId),
  });
}
