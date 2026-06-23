import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch, useStore } from "react-redux";
import calendarService from "../services/api/calendarService";
import integrationsService from "../services/api/integrationsService";
import membersService from "../services/api/membersService";
import userService from "../services/api/userService";
import { leaveSpace } from "../services/api/spacesService";
import { setAuthSession } from "../store/auth/authSlice";

const SETTINGS_PROFILE_QUERY_KEY = ["settings", "profile"];
const AUTH_SESSION_QUERY_KEY = ["auth", "session"];

export function useSettingsProfileQuery() {
  return useQuery({
    queryKey: SETTINGS_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const [profile, preferences] = await Promise.all([
        userService.getCurrentUser(),
        userService.getUserPreferences(),
      ]);

      return {
        profile,
        preferences,
      };
    },
  });
}

export function useUpdateProfileMutation() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updateProfile(payload),
    onSuccess: (updatedUser) => {
      dispatch(
        setAuthSession({
          user: updatedUser,
          isAuthenticated: true,
        }),
      );
      queryClient.invalidateQueries({ queryKey: SETTINGS_PROFILE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    },
  });
}

export function useUpdatePreferencesMutation() {
  const dispatch = useDispatch();
  const store = useStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updateUserPreferences(payload),
    onSuccess: (updatedPreferences, variables) => {
      const currentUser = store.getState()?.users?.user || null;

      if (currentUser && (updatedPreferences?.language || variables?.language)) {
        dispatch(
          setAuthSession({
            user: {
              ...currentUser,
              language: updatedPreferences?.language || variables.language,
            },
            isAuthenticated: true,
          }),
        );
      }

      queryClient.invalidateQueries({ queryKey: SETTINGS_PROFILE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    },
  });
}

export function useIntegrationStatusesQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "integrations", spaceId || "global"],
    queryFn: () => integrationsService.getIntegrationStatuses(spaceId),
  });
}

export function useDisconnectGoogleDriveMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.disconnectGoogleDrive(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "integrations", spaceId || "global"] });
    },
  });
}

export function useGoogleDriveConnectAction() {
  return useCallback(() => {
    window.location.href = integrationsService.getGoogleDriveAuthUrl();
  }, []);
}

export function useGoogleCalendarConnectMutation() {
  return useMutation({
    mutationFn: (spaceId) => calendarService.connectGoogleCalendar(spaceId),
  });
}

export function useGoogleCalendarSyncMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => calendarService.syncGoogleCalendar(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "integrations", spaceId || "global"] });
    },
  });
}

export function useSpaceMembersQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "members", spaceId],
    queryFn: () => membersService.getMembers(spaceId),
    enabled: Boolean(spaceId),
  });
}

export function useSpaceInvitationsQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "invitations", spaceId],
    queryFn: async () => {
      try {
        const data = await membersService.getPendingInvitations(spaceId);
        return {
          items: Array.isArray(data) ? data : [],
          canViewInvitations: true,
        };
      } catch (error) {
        if (error?.response?.status === 403 || error?.status === 403) {
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
    mutationFn: (payload) => membersService.inviteMember(spaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "invitations", spaceId] });
    },
  });
}

export function useUpdateSpaceMemberRoleMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }) => membersService.updateMemberRole(spaceId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "members", spaceId] });
    },
  });
}

export function useRemoveSpaceMemberMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => membersService.removeMember(spaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "members", spaceId] });
    },
  });
}

export function useRevokeSpaceInvitationMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId) => membersService.cancelInvitation(spaceId, inviteId),
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
